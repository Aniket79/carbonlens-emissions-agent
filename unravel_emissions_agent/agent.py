import json
import os
import re
import time
import urllib.error
import urllib.request
from typing import Any, Dict, List, Optional, Tuple

from unravel_emissions_agent import tools

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
DEFAULT_MODEL = "openai/gpt-oss-120b"

GROQ_TOOL_DEFINITIONS = [
    {
        "type": "function",
        "function": {
            "name": "get_emissions_summary",
            "description": "Retrieve overall emissions totals across Scope 1, Scope 2, and Scope 3, percentage shares, records, and reporting period coverage.",
            "parameters": {
                "type": "object",
                "properties": {},
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_scope_breakdown",
            "description": "Retrieve detailed emissions breakdown for a specific scope (Scope 1, Scope 2, or Scope 3).",
            "parameters": {
                "type": "object",
                "properties": {
                    "scope": {
                        "type": "string",
                        "description": "Must be one of: 'Scope 1', 'Scope 2', or 'Scope 3'.",
                    },
                },
                "required": ["scope"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_highest_emitting_categories",
            "description": "Rank the highest-emitting categories and specific activities within Scope 3 or across all scopes, with tCO2e and shares.",
            "parameters": {
                "type": "object",
                "properties": {
                    "scope": {
                        "type": "string",
                        "description": "Optional filter: 'Scope 1', 'Scope 2', 'Scope 3', or 'All'. Defaults to 'Scope 3'.",
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Max categories to return (default 10).",
                    },
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_supplier_emissions",
            "description": "Rank Scope 3 suppliers by total emissions, spend, intensity, and top activities, including data quality warnings.",
            "parameters": {
                "type": "object",
                "properties": {
                    "limit": {
                        "type": "integer",
                        "description": "Max suppliers to return (default 8).",
                    },
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "assess_emissions_quality",
            "description": "Run deterministic emissions data quality and GHG Protocol validity audit across Scope 1, 2, and 3.",
            "parameters": {
                "type": "object",
                "properties": {
                    "scope": {
                        "type": "string",
                        "description": "Optional filter: 'Scope 1', 'Scope 2', 'Scope 3', or 'All'.",
                    },
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_ghg_protocol",
            "description": "Search the GHG Protocol Corporate Standard (ghg-protocol-revised.pdf, 116 pages) for authoritative rules with page numbers.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Search query about GHG Protocol standards, scopes, business travel, Scope 2, etc.",
                    },
                    "top_k": {
                        "type": "integer",
                        "description": "Number of passages to retrieve (default 6).",
                    },
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "compare_peer_emissions",
            "description": "Compare our Scope 1 and Scope 2 emissions against Docusign FY25 and Shopify CY2024 reports with limitation flags.",
            "parameters": {
                "type": "object",
                "properties": {},
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "generate_emissions_report",
            "description": "Generate an executive emissions summary report with scope totals, top categories, quality score, peer comparison, and recommendations.",
            "parameters": {
                "type": "object",
                "properties": {},
            },
        },
    },
]

SYSTEM_PROMPT = """You are CarbonLens, an expert AI Emissions Analysis & Insights Agent for sustainability professionals.

CRITICAL OPERATING RULES:
1. NEVER calculate emissions totals, percentages, rankings, or differences yourself. Always invoke the provided deterministic tools to retrieve exact numbers from the uploaded CSVs, validation engine, peer reports, and GHG Protocol documentation.
2. ALWAYS report exact figures and explicitly note reporting period asymmetry: Scope 1 (3 months: Q1 2024) and Scope 2 (3 months: Q1 2024) cover Q1 only, while Scope 3 covers 12 months (FY 2024).
3. For GHG Protocol rules or methodology questions (e.g., employee business travel scope classification, Scope 2 validity), ALWAYS call search_ghg_protocol AND assess_emissions_quality. Cite exact PDF and printed page numbers from retrieved chunks, and clearly distinguish:
   - What is retrieved from ghg-protocol-revised.pdf (2004 Revised Edition)
   - Subsequent guidance notes (e.g., 2015 Scope 2 Guidance formalizing Location-Based vs. Market-Based dual reporting)
   - General implementation recommendations.
4. For supplier prioritization questions, ALWAYS call get_supplier_emissions AND assess_emissions_quality to present the ranked suppliers while transparently noting the detected supplier-to-activity mismatches in scope3.csv.
5. For peer benchmarking questions, ALWAYS call compare_peer_emissions and explicitly highlight all comparability limitations (Q1 vs 12-month periods, Market-Based vs Location-Based Scope 2, Steam & Manufacturing vs SaaS offices, missing intensity metrics).
6. Never claim formal GHG Protocol compliance or third-party assurance based solely on automated checks. Never invent missing data.
7. Structure your final answer clearly in Markdown with concise headings, bullet points, and exact numbers.
"""


def execute_tool(tool_name: str, args: Dict[str, Any]) -> Dict[str, Any]:
    if tool_name == "get_emissions_summary":
        return tools.get_emissions_summary()
    elif tool_name == "get_scope_breakdown":
        scope = args.get("scope", "Scope 1")
        return tools.get_scope_breakdown(scope=scope)
    elif tool_name == "get_highest_emitting_categories":
        scope = args.get("scope", "Scope 3")
        limit = int(args.get("limit", 10))
        return tools.get_highest_emitting_categories(scope=scope, limit=limit)
    elif tool_name == "get_supplier_emissions":
        limit = int(args.get("limit", 8))
        return tools.get_supplier_emissions(limit=limit)
    elif tool_name == "assess_emissions_quality":
        scope = args.get("scope", "All")
        return tools.assess_emissions_quality(scope=scope)
    elif tool_name == "search_ghg_protocol":
        query = args.get("query", "")
        top_k = int(args.get("top_k", 6))
        return tools.search_ghg_protocol(query=query, top_k=top_k)
    elif tool_name == "compare_peer_emissions":
        return tools.compare_peer_emissions()
    elif tool_name == "generate_emissions_report":
        return tools.generate_emissions_report()
    else:
        return {"error": f"Unknown tool: {tool_name}"}


def _call_groq_api(payload: Dict[str, Any], api_key: str, max_retries: int = 4) -> Dict[str, Any]:
    for attempt in range(max_retries):
        try:
            # Check if official groq Python package is installed; use it if available
            try:
                from groq import Groq
                client = Groq(api_key=api_key)
                response = client.chat.completions.create(
                    model=payload.get("model", DEFAULT_MODEL),
                    messages=payload.get("messages", []),
                    tools=payload.get("tools", None),
                    tool_choice=payload.get("tool_choice", "auto") if payload.get("tools") else None,
                    temperature=payload.get("temperature", 0.1),
                )
                return response.model_dump()
            except ImportError:
                # Standard library HTTP fallback to Groq OpenAI-compatible endpoint
                headers = {
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                    "User-Agent": "CarbonLens-Groq-Agent/1.0",
                }
                req = urllib.request.Request(
                    GROQ_API_URL,
                    data=json.dumps(payload).encode("utf-8"),
                    headers=headers,
                    method="POST",
                )
                with urllib.request.urlopen(req, timeout=45) as resp:
                    return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8")
            if e.code == 429 and attempt < max_retries - 1:
                wait_sec = 8.0
                m = re.search(r"try again in (\d+\.?\d*)s", err_body)
                if m:
                    wait_sec = max(2.0, float(m.group(1)) + 1.5)
                print(f"  [Rate limit 429 reached] Waiting {wait_sec:.1f}s before retry (attempt {attempt + 1}/{max_retries})...")
                time.sleep(wait_sec)
                continue
            raise RuntimeError(f"Groq API error ({e.code}): {err_body}")
        except urllib.error.URLError as e:
            if attempt < max_retries - 1:
                time.sleep(3.0)
                continue
            raise RuntimeError(f"Groq API connection timeout or network error: {e.reason}")
        except Exception as e:
            # Check for groq SDK RateLimitError if SDK was used
            err_str = str(e)
            if ("429" in err_str or "rate_limit" in err_str.lower()) and attempt < max_retries - 1:
                wait_sec = 8.0
                m = re.search(r"try again in (\d+\.?\d*)s", err_str)
                if m:
                    wait_sec = max(2.0, float(m.group(1)) + 1.5)
                print(f"  [Rate limit 429 reached] Waiting {wait_sec:.1f}s before retry (attempt {attempt + 1}/{max_retries})...")
                time.sleep(wait_sec)
                continue
            raise


def run_groq_agent(
    user_prompt: str,
    history: List[Dict[str, str]] = None,
    api_key: Optional[str] = None,
    model: Optional[str] = None,
) -> Tuple[str, List[Dict[str, Any]]]:
    """
    Executes the complete tool-calling loop:
    User question -> Model tool selection -> Python execution -> Tool result -> Model final response.
    Supports multiple sequential tool calls.
    """
    key = api_key or os.environ.get("GROQ_API_KEY")
    if not key or key == "your_api_key":
        raise ValueError("GROQ_API_KEY environment variable is not configured.")

    groq_model = model or os.environ.get("GROQ_MODEL") or DEFAULT_MODEL

    messages: List[Dict[str, Any]] = [{"role": "system", "content": SYSTEM_PROMPT}]

    if history:
        for h in history[-6:]:
            messages.append({"role": h.get("role", "user"), "content": h.get("content", "")})

    messages.append({"role": "user", "content": user_prompt})

    tool_traces: List[Dict[str, Any]] = []

    for round_num in range(8):
        payload = {
            "model": groq_model,
            "messages": messages,
            "tools": GROQ_TOOL_DEFINITIONS,
            "tool_choice": "auto",
            "temperature": 0.1,
        }

        resp = _call_groq_api(payload, key)
        choices = resp.get("choices", [])
        if not choices:
            break

        msg = choices[0].get("message", {})
        tool_calls = msg.get("tool_calls", [])

        if not tool_calls:
            # Model produced final answer
            final_text = msg.get("content", "") or ""
            return final_text, tool_traces

        # Append assistant's tool-calling intent message
        messages.append(msg)

        # Execute each tool call sequentially
        for tc in tool_calls:
            func = tc.get("function", {})
            name = func.get("name", "")
            raw_args = func.get("arguments", "{}")
            try:
                args = json.loads(raw_args) if isinstance(raw_args, str) else raw_args
            except Exception:
                args = {}

            # Python execution of the tool
            result = execute_tool(name, args)

            tool_traces.append({
                "tool_name": name,
                "arguments": args,
                "result_preview": str(result)[:200],
            })

            messages.append({
                "role": "tool",
                "tool_call_id": tc.get("id", ""),
                "content": json.dumps(result),
            })

    # If loop ended, do one final turn for summary
    final_payload = {
        "model": groq_model,
        "messages": messages,
        "temperature": 0.1,
    }
    final_resp = _call_groq_api(final_payload, key)
    final_text = final_resp.get("choices", [{}])[0].get("message", {}).get("content", "")
    return final_text, tool_traces
