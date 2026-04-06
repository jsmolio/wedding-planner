"""FastAPI server that exposes the wedding-planner agent over HTTP.

Endpoints
---------
GET  /        – chat UI
POST /chat    – send a message **or** confirm/reject an interrupted action
GET  /health  – liveness check

Streaming
---------
When ``stream: true`` is sent in the POST body, the response is an SSE
stream of token-level chunks followed by a ``[DONE]`` sentinel.

Human-in-the-loop
------------------
When the agent wants to call a *write* tool the graph pauses via
``interrupt()``.  The server detects this and returns a JSON payload with
``"type": "confirm"`` so the client can show a confirmation dialog.
The client then POSTs back with ``confirm: "approve"`` or ``"reject"``
to resume the graph.

LangSmith tracing is enabled automatically when the ``LANGSMITH_*``
environment variables are set (see ``.env.example``).
"""

from __future__ import annotations

import json
import os
from pathlib import Path

from dotenv import load_dotenv

# Load .env *before* any LangChain imports so tracing env vars are picked up.
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from fastapi import FastAPI, Header  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from langchain_core.messages import HumanMessage  # noqa: E402
from langgraph.types import Command  # noqa: E402
from pydantic import BaseModel  # noqa: E402
from starlette.responses import StreamingResponse  # noqa: E402

from wedding_agent.db import get_client, set_wedding_id  # noqa: E402
from wedding_agent.graph import graph  # noqa: E402

app = FastAPI(title="Wedding Planner Agent")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class Attachment(BaseModel):
    name: str
    type: str  # "text" or "image"
    content: str  # text content or base64 data URL


class ChatRequest(BaseModel):
    message: str | None = None
    thread_id: str = "default"
    confirm: str | None = None  # "approve" or "reject"
    stream: bool = False
    attachments: list[Attachment] | None = None


def _resolve_wedding_id(authorization: str | None) -> str | None:
    """Verify the user's JWT and look up their wedding ID."""
    if not authorization or not authorization.startswith("Bearer "):
        return None

    token = authorization[7:]
    try:
        # Verify the JWT with Supabase and get the user
        sb = get_client()
        user_resp = sb.auth.get_user(token)
        user_id = user_resp.user.id

        # Look up wedding membership
        result = (
            sb.table("wedding_members")
            .select("wedding_id")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        if result.data:
            return result.data[0]["wedding_id"]
    except Exception as exc:
        print(f"[AUTH] Failed to resolve wedding_id: {exc}", flush=True)
    return None


class ChatResponse(BaseModel):
    reply: str | None = None
    type: str = "message"  # "message" | "confirm"
    confirm_message: str | None = None


def _run_config(thread_id: str) -> dict:
    return {
        "configurable": {"thread_id": thread_id},
        "recursion_limit": 80,
        "run_name": "wedding_planner_chat",
        "tags": ["wedding-planner", "api"],
        "metadata": {"thread_id": thread_id},
    }


def _build_message(req: ChatRequest) -> HumanMessage:
    """Build a HumanMessage, optionally with multimodal attachments."""
    parts: list = []
    text = req.message or ""

    if req.attachments:
        for att in req.attachments:
            if att.type == "text":
                text += f"\n\n--- Attached file: {att.name} ---\n{att.content}"
            elif att.type == "image":
                parts.append({"type": "image_url", "image_url": {"url": att.content}})
                text += f"\n\n[Attached image: {att.name}]"

    if parts:
        parts.insert(0, {"type": "text", "text": text})
        return HumanMessage(content=parts)

    return HumanMessage(content=text)


def _extract_reply(result: dict) -> str:
    """Pull the final assistant text from the graph result."""
    return result["messages"][-1].content


def _check_interrupt(thread_id: str) -> dict | None:
    """If the graph is paused at an interrupt, return the interrupt payload."""
    state = graph.get_state(_run_config(thread_id))
    if state.next:  # graph still has pending nodes → interrupted
        # The interrupt value is in state.tasks
        for task in state.tasks:
            if hasattr(task, "interrupts") and task.interrupts:
                return task.interrupts[0].value
    return None


@app.post("/chat")
async def chat(req: ChatRequest, authorization: str | None = Header(default=None)):
    """Run the agent graph and return the final assistant message.

    If ``confirm`` is set, resumes a previously interrupted graph run.
    If ``stream`` is true, returns an SSE stream instead.
    """
    config = _run_config(req.thread_id)

    # Resolve the wedding ID from the user's auth token
    wedding_id = _resolve_wedding_id(authorization)
    if wedding_id:
        set_wedding_id(wedding_id)

    # ── Resume from interrupt ───────────────────────────────────────────
    if req.confirm:
        result = graph.invoke(Command(resume=req.confirm), config)
        return ChatResponse(reply=_extract_reply(result))

    if not req.message and not req.attachments:
        return ChatResponse(reply="Please send a message.", type="message")

    human_msg = _build_message(req)

    # ── Stream mode ─────────────────────────────────────────────────────
    if req.stream:
        return _stream_response(human_msg, config)

    # ── Normal (non-streaming) mode ─────────────────────────────────────
    result = graph.invoke(
        {"messages": [human_msg]},
        config,
    )

    # Check if the graph interrupted (human-in-the-loop)
    interrupt_payload = _check_interrupt(req.thread_id)
    if interrupt_payload:
        return ChatResponse(
            type="confirm",
            confirm_message=interrupt_payload.get("message", "Approve this action?"),
        )

    return ChatResponse(reply=_extract_reply(result))


_TOOL_LABELS = {
    "lookup_guests": "Looking up guest list",
    "lookup_budget": "Checking budget",
    "lookup_checklist": "Reviewing checklist",
    "lookup_venues": "Looking up venues",
    "lookup_seating": "Checking seating arrangement",
    "search_wedding_knowledge": "Searching wedding tips",
    "web_search": "Searching the web",
    "fetch_page": "Reading webpage",
    "create_record": "Creating record",
    "update_record": "Updating record",
    "delete_record": "Deleting record",
}


def _stream_response(message: HumanMessage, config: dict) -> StreamingResponse:
    """Return an SSE stream of token chunks."""

    async def generate():
        final_text = ""
        interrupted = False

        try:
            async for event in graph.astream_events(
                {"messages": [message]},
                config=config,
                version="v2",
            ):
                kind = event["event"]

                if kind == "on_chat_model_stream":
                    chunk = event["data"]["chunk"]
                    if chunk.content:
                        final_text += chunk.content
                        yield f"data: {json.dumps({'type': 'token', 'content': chunk.content})}\n\n"

                elif kind == "on_tool_start":
                    tool_name = event["name"]
                    label = _TOOL_LABELS.get(tool_name, tool_name)
                    yield f"data: {json.dumps({'type': 'status', 'content': label})}\n\n"

                elif kind == "on_tool_end":
                    yield f"data: {json.dumps({'type': 'status', 'content': 'Thinking'})}\n\n"
        except Exception as exc:
            yield f"data: {json.dumps({'type': 'token', 'content': f'Sorry, something went wrong: {exc}'})}\n\n"

        # After streaming completes, check for interrupt
        thread_id = config["configurable"]["thread_id"]
        interrupt_payload = _check_interrupt(thread_id)
        if interrupt_payload:
            yield f"data: {json.dumps({'type': 'confirm', 'confirm_message': interrupt_payload.get('message', 'Approve this action?')})}\n\n"
            interrupted = True

        if not interrupted:
            yield f"data: {json.dumps({'type': 'done'})}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")



@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}



def main() -> None:
    import uvicorn

    port = int(os.environ.get("PORT", "8000"))
    uvicorn.run(
        "wedding_agent.server:app",
        host="0.0.0.0",
        port=port,
        reload=os.environ.get("RENDER") is None,  # only reload in dev
    )


if __name__ == "__main__":
    main()
