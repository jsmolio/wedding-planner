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

llm = ChatOpenAI(model="gpt-4.1", temperature=0).bind_tools(
    [*all_tools, search_wedding_knowledge]
)

SYSTEM_PROMPT = """\
You are a friendly, knowledgeable wedding-planning assistant.

## How to think (ReAct)

You solve problems by iterating through Thought → Action → Observation loops. \
You can go around this loop as many times as needed — call the same tool \
again with a refined query, or call different tools to cross-reference data. \
Do NOT give a final answer until you have concrete information.

1. **Thought** — What does the user need? What data am I missing? Which \
tool(s) should I call next?
2. **Action** — Call one or more tools.
3. **Observation** — Look at the results. Are they enough? Do I need to \
dig deeper, fetch a page, or cross-reference with wedding data? If yes, \
loop back to Thought.
4. **Answer** — Only when I have real data. Synthesize, connect insights, \
offer next steps.

## Tools

Wedding data (instant):
• lookup_guests, lookup_budget, lookup_checklist, lookup_venues, lookup_seating

Web (instant):
• web_search – search the internet for anything. Call multiple times to refine.
• fetch_page – fetch a URL to get text content and images. Use this to \
get real details (prices, capacity, photos) from pages found via web_search.

Knowledge:
• search_wedding_knowledge – search the wedding advice knowledge base

Write (require user confirmation):
• update_guest_rsvp, add_budget_expense
• add_venue — when calling this, ALWAYS include the photo_urls parameter \
with image URLs you collected from fetch_page. This makes the confirmation \
dialog show venue photos so the user can make an informed decision.

## Key principles

- **No duplicates.** Before suggesting venues, call lookup_venues to see \
what the couple already has saved. Exclude those from results.
- **Cross-reference.** Call lookup_budget and lookup_guests so you can \
compare venue prices/capacity against the couple's real numbers.

### Venue search — MANDATORY multi-round process

You MUST follow ALL of these rounds. Do NOT skip to the answer early.

**Round 1:** Call lookup_venues + lookup_budget + lookup_guests to get \
the couple's saved venues, budget, and guest count.

**Round 2:** Call web_search to find venue names. Use specific queries \
like "best outdoor wedding venues near Denver Colorado with pricing".

**Round 3 — THIS IS CRITICAL:** Pick the 5 best venues from Round 2 \
(excluding any already saved). For EACH of the 5 venues, call \
web_search("[exact venue name] wedding venue") to find its own website, \
then call fetch_page on the venue's direct URL. You MUST fetch all 5 \
individual venue websites. Listing/aggregator pages do NOT have \
venue-specific images or pricing — you MUST visit each venue's own site.

**Round 4:** Present exactly 5 results. EVERY venue MUST use this format:

### [Venue Name]
![Venue Name](image_url_1)
![Venue Name](image_url_2)
![Venue Name](image_url_3)
- **Price:** $X,XXX – $X,XXX (or "Contact for pricing" if unknown)
- **Capacity:** XXX guests
- **Location:** Full address
- **Contact:** Name, email, phone (from their website)
- **Website:** [venue URL](venue URL)
- **Why it fits:** Brief note on budget/guest count match

Key rules:
- Every venue MUST have 3-5 images showing the venue (ceremony space, \
reception hall, grounds, etc.). Place them on consecutive lines right \
after the venue heading — the UI will render them as a scrollable \
photo gallery. Pick the best venue-showcasing images from the fetch_page \
results. If fetch_page returned fewer than 3 good images, search for \
"[venue name] wedding photos" and fetch that page for more.
- Every venue MUST have a price estimate. Extract it from the page text. \
If you truly cannot find pricing, write "Contact for pricing" — never \
just omit it.
- Every venue MUST have a website link.
- Show 5 results. Tell the user they can ask for more.
- Offer to add any venue to their saved list.

### Choosing images

fetch_page returns ALL images from a page. Most are NOT venue photos. \
You must carefully curate — only use images that are actual photographs \
of the venue: the building exterior, ceremony space, reception hall, \
gardens, table setups, or landscape views.

REJECT any image URL that contains ANY of these words: logo, icon, \
avatar, staff, team, headshot, profile, bio, social, facebook, twitter, \
instagram, pinterest, linkedin, badge, payment, visa, mastercard, \
favicon, spinner, arrow, button, placeholder, 1x1, pixel, spacer, \
marker, map, calendar, phone, email, .svg, widget, banner, ad, cta, \
partner, sponsor, award, certification, seal, ribbon, check, star-rating.

REJECT images that are clearly not photos: tiny thumbnails, icons, \
infographics, text overlays, marketing graphics, or anything that \
looks like a UI element rather than a photograph.

Only use images with URLs that look like actual photo files (jpg, jpeg, \
png, webp) hosted on the venue's own domain or a CDN. Never use the \
same image URL twice — every image must be unique. When in doubt, \
leave it out. 3 good venue photos are better than 5 with junk mixed in.

### Other principles
- **Be specific.** "The Garden Estate — $8,500, seats 200, within your \
$10k venue budget" is useful. "Check out WeddingWire" is not.
- **Offer actions.** After presenting options, offer to add a venue, \
update an RSVP, etc.
- Use bullet points for lists. Round dollar amounts.
- Do not fabricate data — if a tool can answer it, use the tool.
"""

PII_NOTICE = (
    "\n\n⚠️ Note: the user's message contained personal information that has "
    "been automatically redacted for privacy.  Acknowledge the redaction "
    "briefly and continue helping."
)

# ── Helpers ────────────────────────────────────────────────────────────────


def _friendly_description(tc: dict) -> str:
    """Turn a raw tool call into a human-readable markdown confirmation."""
    name = tc["name"]
    args = tc.get("args", {})

    if name == "add_venue":
        venue = args.get("name", "Unknown venue")
        parts = [f"### Save {venue}?\n"]

        # Show photos
        photos = args.get("photo_urls") or []
        for url in photos[:3]:
            parts.append(f"![{venue}]({url})\n")

        details = []
        if args.get("address"):
            details.append(f"**Location:** {args['address']}")
        if args.get("capacity"):
            details.append(f"**Capacity:** {args['capacity']} guests")
        if args.get("cost"):
            details.append(f"**Price:** ${args['cost']:,.0f}")
        if args.get("website_url"):
            details.append(f"**Website:** [{args['website_url']}]({args['website_url']})")
        if args.get("notes"):
            details.append(f"**Notes:** {args['notes']}")

        parts.append("\n".join(details))
        return "\n".join(parts)

    if name == "update_guest_rsvp":
        guest = args.get("guest_name", "Unknown")
        status = args.get("status", "unknown")
        return f'Update RSVP for **{guest}** to **{status}**?'

    if name == "add_budget_expense":
        cat = args.get("category", "")
        desc = args.get("description", "")
        amount = args.get("amount", 0)
        return f'Record **${amount:,.2f}** expense for "**{desc}**" under **{cat}**?'

    # Fallback
    return f"{name}: {json.dumps(args)}"


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

    descriptions = "\n".join(_friendly_description(tc) for tc in write_calls)

    decision = interrupt({
        "type": "confirm_action",
        "message": descriptions,
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
builder.add_node("read_tools", ToolNode(all_tool_objs, handle_tool_errors=True))
builder.add_node("human_review", human_review_node)
builder.add_node("write_tools", ToolNode(all_tool_objs, handle_tool_errors=True))

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
