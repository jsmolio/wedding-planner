"""Agent state definition.

The graph carries two keys:

- ``messages`` — the conversation history (LangGraph's ``add_messages``
  reducer handles de-duplication and ordering automatically).
- ``pii_detected`` — set to ``True`` by the guardrails node when PII is
  found and redacted so the LLM can inform the user.

State flow
----------
START ──▶ guardrails ──▶ agent ──┬──▶ END
                                 ├──▶ read_tools  ──▶ agent (loop)
                                 └──▶ human_review ──▶ write_tools ──▶ agent
"""

from __future__ import annotations

from typing import Annotated, TypedDict

from langchain_core.messages import AnyMessage
from langgraph.graph.message import add_messages


class PlannerState(TypedDict):
    """State for the wedding-planner agent."""

    messages: Annotated[list[AnyMessage], add_messages]
    pii_detected: bool
