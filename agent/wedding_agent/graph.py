"""LangGraph definition for the wedding-planner agent.

Graph structure
---------------

        ┌───────────┐
        │   START    │
        └─────┬─────┘
              ▼
       ┌─────────────┐
       │  guardrails  │  ← PII redaction
       └──────┬──────┘
              ▼
       ┌─────────────┐
  ┌───▶│    agent     │◀─────────────────────┐
  │    └──────┬──────┘                        │
  │      route_tools?                         │
  │     ╱     │      ╲                        │
  │    ▼      ▼       ▼                       │
  │  END   read     human_review              │
  │       tools    (⏸ interrupt)              │
  │         │      approve / reject           │
  │         │       ╱        ╲                │
  │         │  write_tools   (cancel msg)     │
  │         │      │              │           │
  │         └──────┴──────────────┴───────────┘

Nodes
-----
- **guardrails** — scans user input for PII and redacts it.
- **agent** — invokes GPT-4o-mini with system prompt + message history.
- **read_tools** — executes read-only tool calls (guest list, budget, etc.).
- **human_review** — pauses the graph via ``interrupt()`` for user
  confirmation before executing write operations.
- **write_tools** — executes write tool calls after user approval.

Checkpointing
-------------
The graph is compiled with a ``MemorySaver`` checkpointer so conversation
state persists across turns within a thread, and the ``interrupt()`` in
``human_review`` can pause and resume correctly.
"""

from __future__ import annotations

import json

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, StateGraph
from langgraph.prebuilt import ToolNode
from langgraph.types import interrupt

from wedding_agent.guardrails import redact_pii
from wedding_agent.rag import search_wedding_knowledge
from wedding_agent.state import PlannerState
from wedding_agent.tools import (
    WRITE_TOOL_NAMES,
    all_tools,
    read_tools,
    write_tools,
)

# ── LLM with tools bound ───────────────────────────────────────────────────

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0).bind_tools(
    [*all_tools, search_wedding_knowledge]
)

SYSTEM_PROMPT = """\
You are a friendly, knowledgeable wedding-planning assistant.

You have access to the following tools:

READ tools (instant access):
• lookup_guests  – query the guest list (count, RSVPs, dietary needs)
• lookup_budget  – query budget categories and spending
• lookup_checklist – query the planning checklist and upcoming tasks
• search_wedding_knowledge – search a knowledge base of wedding advice

WRITE tools (require user confirmation before executing):
• update_guest_rsvp – update a guest's RSVP status
• add_budget_expense – record a new expense

Guidelines:
1. Use tools to answer factual questions about *this* wedding's data.
2. Use search_wedding_knowledge for general advice or best-practice questions.
3. Be warm and helpful.  Use bullet points for lists.
4. When you cite numbers from the tools, round to the nearest dollar.
5. If you are unsure, say so — do not fabricate data.
6. When tool results include individual records (e.g. guest names), show them
   to the user — do not hide detailed data behind a summary unless the user
   only asked for a summary.
"""

PII_NOTICE = (
    "\n\n⚠️ Note: the user's message contained personal information that has "
    "been automatically redacted for privacy.  Acknowledge the redaction "
    "briefly and continue helping."
)

# ── Node functions ──────────────────────────────────────────────────────────


def guardrails_node(state: PlannerState) -> dict:
    """Scan the latest user message for PII and redact if found."""
    last = state["messages"][-1]
    if not isinstance(last, HumanMessage):
        return {"pii_detected": False}

    redacted_text, found = redact_pii(last.content)
    if found:
        # Replace the message with redacted version (same ID → dedup merge)
        new_msg = HumanMessage(content=redacted_text, id=last.id)
        return {"messages": [new_msg], "pii_detected": True}
    return {"pii_detected": False}


def agent_node(state: PlannerState) -> dict:
    """Invoke the LLM with the full message history + system prompt."""
    prompt = SYSTEM_PROMPT
    if state.get("pii_detected"):
        prompt += PII_NOTICE
    messages = [SystemMessage(content=prompt), *state["messages"]]
    response = llm.invoke(messages)
    return {"messages": [response]}


def human_review_node(state: PlannerState) -> dict:
    """Pause for user confirmation before executing write operations.

    Uses LangGraph's ``interrupt()`` to suspend the graph.  The server
    returns the interrupt payload to the client, which shows a confirmation
    dialog.  When the user responds, the server resumes the graph with
    the user's decision.
    """
    last = state["messages"][-1]
    write_calls = [
        tc for tc in (getattr(last, "tool_calls", None) or [])
        if tc["name"] in WRITE_TOOL_NAMES
    ]

    descriptions = "\n".join(
        f"- {tc['name']}({json.dumps(tc['args'])})" for tc in write_calls
    )

    decision = interrupt({
        "type": "confirm_action",
        "message": f"I'd like to perform the following:\n{descriptions}\n\nApprove or reject?",
    })

    if decision == "approve":
        # Pass through — tool_calls stay on the last message, route to write_tools
        return {}

    # User rejected — replace the tool-calling message with a cancellation
    return {
        "messages": [
            AIMessage(
                content="No problem — I've cancelled that action. What else can I help with?"
            )
        ]
    }


# ── Routing functions ───────────────────────────────────────────────────────


def route_after_agent(state: PlannerState) -> str:
    """Decide where to go after the agent node."""
    last = state["messages"][-1]
    tool_calls = getattr(last, "tool_calls", None)
    if not tool_calls:
        return END

    if any(tc["name"] in WRITE_TOOL_NAMES for tc in tool_calls):
        return "human_review"

    return "read_tools"


def route_after_review(state: PlannerState) -> str:
    """After human review, go to write_tools if approved, else back to agent."""
    last = state["messages"][-1]
    if getattr(last, "tool_calls", None):
        return "write_tools"
    # Rejection — the cancellation AIMessage is the final response
    return END


# ── Build graph ─────────────────────────────────────────────────────────────

all_tool_objs = [*all_tools, search_wedding_knowledge]

builder = StateGraph(PlannerState)

builder.add_node("guardrails", guardrails_node)
builder.add_node("agent", agent_node)
builder.add_node("read_tools", ToolNode(all_tool_objs))
builder.add_node("human_review", human_review_node)
builder.add_node("write_tools", ToolNode(all_tool_objs))

builder.add_edge(START, "guardrails")
builder.add_edge("guardrails", "agent")
builder.add_conditional_edges(
    "agent",
    route_after_agent,
    {"read_tools": "read_tools", "human_review": "human_review", END: END},
)
builder.add_edge("read_tools", "agent")
builder.add_conditional_edges(
    "human_review",
    route_after_review,
    {"write_tools": "write_tools", END: END},
)
builder.add_edge("write_tools", "agent")

# Compile with checkpointing so threads persist and interrupt() works.
memory = MemorySaver()
graph = builder.compile(checkpointer=memory)
