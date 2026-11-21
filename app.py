"""
CarbonLens — Emissions Analysis & Insights Agent (Streamlit Application)
Powered by Groq API (openai/gpt-oss-120b)
"""

import os
import json
import streamlit as st

# Load environment variables if dotenv is available
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from unravel_emissions_agent import tools
from unravel_emissions_agent.agent import run_groq_agent

st.set_page_config(
    page_title="CarbonLens — Emissions Insights Agent",
    page_icon="🌱",
    layout="wide",
)

# Initialize Streamlit session state for conversation history
if "messages" not in st.session_state:
    st.session_state["messages"] = []

if "tool_history" not in st.session_state:
    st.session_state["tool_history"] = []

# Sidebar
with st.sidebar:
    st.title("🌱 CarbonLens")
    st.caption("AI Emissions Analysis & Insights Agent")

    model_name = os.environ.get("GROQ_MODEL", "openai/gpt-oss-120b")
    st.info(f"**Engine:** Groq API\n**Model:** `{model_name}`")

    has_key = bool(os.environ.get("GROQ_API_KEY"))
    if has_key:
        st.success("GROQ_API_KEY is configured")
    else:
        st.error("GROQ_API_KEY not found in environment")

    st.markdown("---")
    st.subheader("Data Sources")
    st.markdown("- `scope1.csv` (18 rows, Q1 2024)\n- `scope2.csv` (18 rows, Q1 2024)\n- `scope3.csv` (1,000 rows, FY2024)\n- `ghg-protocol-revised.pdf`\n- `peer1_emissions_report.pdf` (Docusign FY25)\n- `peer2_emissions_report.pdf` (Shopify 2024)")

    st.markdown("---")
    st.subheader("Quick Test Questions")
    test_q1 = "Should employee business travel be classified as Scope 1 or Scope 3? Explain the reasoning and describe how I can calculate my business travel emissions?"
    test_q2 = "Are my scope 2 emissions calculation valid according to the Greenhouse Gas Protocol?"
    test_q3 = "How do my scope 1 & 2 emissions compare with other companies (refer to peer reports in the data sources) in my industry, and what insights can I derive from this comparison?"
    test_q4 = "What is our highest emitting Scope 3 category and what specific activities contribute to it?"
    test_q5 = "Which suppliers should I prioritise to engage for emissions reduction efforts?"
    test_q6 = "Generate a summary report of our total emissions by scope with key insights"

    if st.button("Core Q1: Business Travel Scope", use_container_width=True):
        st.session_state["prompt_input"] = test_q1
    if st.button("Core Q2: Scope 2 Validity Audit", use_container_width=True):
        st.session_state["prompt_input"] = test_q2
    if st.button("Core Q3: Peer Benchmarking", use_container_width=True):
        st.session_state["prompt_input"] = test_q3
    if st.button("Bonus Q1: Highest Scope 3 Category", use_container_width=True):
        st.session_state["prompt_input"] = test_q4
    if st.button("Bonus Q2: Supplier Prioritization", use_container_width=True):
        st.session_state["prompt_input"] = test_q5
    if st.button("Bonus Q3: Emissions Summary Report", use_container_width=True):
        st.session_state["prompt_input"] = test_q6

    if st.button("Clear Conversation", use_container_width=True):
        st.session_state["messages"] = []
        st.session_state["tool_history"] = []
        st.rerun()

st.header("Corporate Greenhouse Gas Emissions Assistant")
st.caption("Deterministic analytical calculations paired with Groq function calling & GHG Protocol retrieval.")

# Render existing messages from session state
for msg in st.session_state["messages"]:
    with st.chat_message(msg["role"]):
        st.markdown(msg["content"])
        if msg.get("tools"):
            with st.expander("Executed Python Tools"):
                for t in msg["tools"]:
                    st.markdown(f"**`{t['tool_name']}`** with `{t['arguments']}`")

# Handle user input
user_input = st.chat_input("Ask about Scope 1-3 emissions, GHG Protocol rules, or peer benchmarks...")
prompt_to_send = None

if user_input:
    prompt_to_send = user_input
elif "prompt_input" in st.session_state and st.session_state["prompt_input"]:
    prompt_to_send = st.session_state["prompt_input"]
    del st.session_state["prompt_input"]

if prompt_to_send:
    # Append user message
    st.session_state["messages"].append({"role": "user", "content": prompt_to_send})
    with st.chat_message("user"):
        st.markdown(prompt_to_send)

    with st.chat_message("assistant"):
        with st.spinner("Executing Python analytical tools & generating insights with Groq..."):
            try:
                history = [
                    {"role": m["role"], "content": m["content"]}
                    for m in st.session_state["messages"][:-1]
                ]
                final_answer, tool_traces = run_groq_agent(
                    user_prompt=prompt_to_send,
                    history=history,
                    model=model_name,
                )
                st.markdown(final_answer)
                if tool_traces:
                    with st.expander(f"Executed {len(tool_traces)} Python Tool(s)"):
                        for trace in tool_traces:
                            st.markdown(f"- **`{trace['tool_name']}`** args: `{trace['arguments']}`")
                            st.caption(f"Preview: `{trace['result_preview']}`")

                # Store assistant response in session state
                st.session_state["messages"].append({
                    "role": "assistant",
                    "content": final_answer,
                    "tools": tool_traces,
                })
            except Exception as e:
                err_msg = f"**Error executing agent:** {str(e)}"
                st.error(err_msg)
                st.session_state["messages"].append({
                    "role": "assistant",
                    "content": err_msg,
                })
