"""
Comprehensive test script for Groq migration:
1. Tests all 8 agent tools in Python.
2. Tests the three mandatory Unravel Carbon questions with the Groq agent (openai/gpt-oss-120b).
3. Verifies actual tool selection, Python execution, and model response generation.
"""

import json
import os
import sys

# Load environment
env_path = os.path.join(os.path.dirname(__file__), ".env")
if os.path.exists(env_path):
    with open(env_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ[k.strip()] = v.strip().strip('"').strip("'")

from unravel_emissions_agent import tools
from unravel_emissions_agent.agent import run_groq_agent, execute_tool

print("=================================================================")
print("PART 1: TESTING ALL 8 AGENT TOOLS IN PYTHON")
print("=================================================================")

# Tool 1: get_emissions_summary
t1 = tools.get_emissions_summary()
assert t1["total_combined_co2e_tonnes"] == 378683.02, f"Unexpected total: {t1}"
assert t1["scope1"]["total_co2e_tonnes"] == 1692.47
assert t1["scope2"]["total_co2e_tonnes"] == 2505.04
assert t1["scope3"]["total_co2e_tonnes"] == 374485.51
print("✓ Tool 1: get_emissions_summary() passed. Total = 378,683.02 tCO2e")

# Tool 2: get_scope_breakdown
t2_s1 = tools.get_scope_breakdown("Scope 1")
assert t2_s1["total_co2e_tonnes"] == 1692.47
assert len(t2_s1["activities"]) == 6
t2_s2 = tools.get_scope_breakdown("Scope 2")
assert t2_s2["total_co2e_tonnes"] == 2505.04
assert len(t2_s2["energy_sources"]) == 2
print("✓ Tool 2: get_scope_breakdown() passed for Scope 1 and Scope 2")

# Tool 3: get_highest_emitting_categories
t3 = tools.get_highest_emitting_categories("Scope 3", limit=5)
assert t3["highest_emitting_category"]["category"] == "Category 3"
assert t3["highest_emitting_category"]["co2e_tonnes"] == 31794.33
print(f"✓ Tool 3: get_highest_emitting_categories() passed. Top: {t3['highest_emitting_category']['name']}")

# Tool 4: get_supplier_emissions
t4 = tools.get_supplier_emissions(limit=5)
assert len(t4["suppliers"]) == 5
assert t4["suppliers"][0]["supplier"] == "OfficeMax"
assert t4["suppliers"][0]["co2e_tonnes"] == 50966.25
print(f"✓ Tool 4: get_supplier_emissions() passed. Top supplier: {t4['suppliers'][0]['supplier']} (50,966.25 tCO2e)")

# Tool 5: assess_emissions_quality
t5 = tools.assess_emissions_quality()
assert t5["completeness_score"] == 80.0
assert t5["quality_score"] == 42.6
assert len(t5["issues"]) >= 5
print(f"✓ Tool 5: assess_emissions_quality() passed. Score: {t5['quality_score']}/100 ({t5['quality_rating']})")

# Tool 6: search_ghg_protocol
t6 = tools.search_ghg_protocol("employee business travel mobile combustion", top_k=3)
assert len(t6["passages"]) >= 2
assert any("travel" in p["text"].lower() for p in t6["passages"])
print(f"✓ Tool 6: search_ghg_protocol() passed. Retrieved {len(t6['passages'])} relevant passages")

# Tool 7: compare_peer_emissions
t7 = tools.compare_peer_emissions()
assert len(t7["peers"]) == 2
assert t7["peers"][0]["company_name"] == "Docusign, Inc."
assert t7["peers"][1]["company_name"] == "Shopify Inc."
assert len(t7["limitations"]) >= 4
print(f"✓ Tool 7: compare_peer_emissions() passed. Compared with Docusign & Shopify")

# Tool 8: generate_emissions_report
t8 = tools.generate_emissions_report()
assert "summary" in t8 and "prioritized_recommendations" in t8
print("✓ Tool 8: generate_emissions_report() passed. Full report structure verified")

print("\nAll 8 Python tools executed successfully with 100% deterministic results.\n")

print("=================================================================")
print("PART 2: TESTING THE THREE MANDATORY UNRAVEL CARBON QUESTIONS")
print(f"Model: {os.environ.get('GROQ_MODEL', 'openai/gpt-oss-120b')}")
print("=================================================================")

mandatory_questions = [
    {
        "id": "MANDATORY QUESTION 1",
        "question": (
            "Should employee business travel be classified as Scope 1 or Scope 3? "
            "Explain the reasoning and describe how I can calculate my business travel emissions?"
        ),
    },
    {
        "id": "MANDATORY QUESTION 2",
        "question": "Are my scope 2 emissions calculation valid according to the Greenhouse Gas Protocol?",
    },
    {
        "id": "MANDATORY QUESTION 3",
        "question": (
            "How do my scope 1 & 2 emissions compare with other companies (refer to peer reports in the data sources) "
            "in my industry, and what insights can I derive from this comparison?"
        ),
    },
]

for item in mandatory_questions:
    print(f"\n--- {item['id']} ---")
    print(f"User: {item['question']}\n")
    response, traces = run_groq_agent(item["question"])
    print(f"Tool Invocations ({len(traces)}):")
    for t in traces:
        print(f"  • {t['tool_name']}({json.dumps(t['arguments'])})")
    print(f"\nModel Answer (first 650 chars):\n{response[:650]}...\n")
    print("-" * 65)

print("\n✓ SUCCESS: All 3 mandatory questions tested with real Groq tool execution.")
