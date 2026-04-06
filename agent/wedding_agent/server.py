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
from pathlib import Path

from dotenv import load_dotenv

# Load .env *before* any LangChain imports so tracing env vars are picked up.
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from fastapi import FastAPI  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from langchain_core.messages import HumanMessage  # noqa: E402
from langgraph.types import Command  # noqa: E402
from pydantic import BaseModel  # noqa: E402
from starlette.responses import FileResponse, StreamingResponse  # noqa: E402

from wedding_agent.graph import graph  # noqa: E402

STATIC_DIR = Path(__file__).resolve().parent / "static"

app = FastAPI(title="Wedding Planner Agent")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def index():
    """Serve the chat UI."""
    return FileResponse(STATIC_DIR / "index.html")


class ChatRequest(BaseModel):
    message: str | None = None
    thread_id: str = "default"
    confirm: str | None = None  # "approve" or "reject"
    stream: bool = False


class ChatResponse(BaseModel):
    reply: str | None = None
    type: str = "message"  # "message" | "confirm"
    confirm_message: str | None = None


def _run_config(thread_id: str) -> dict:
    return {
        "configurable": {"thread_id": thread_id},
        "run_name": "wedding_planner_chat",
        "tags": ["wedding-planner", "api"],
        "metadata": {"thread_id": thread_id},
    }


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
async def chat(req: ChatRequest):
    """Run the agent graph and return the final assistant message.

    If ``confirm`` is set, resumes a previously interrupted graph run.
    If ``stream`` is true, returns an SSE stream instead.
    """
    config = _run_config(req.thread_id)

    # ── Resume from interrupt ───────────────────────────────────────────
    if req.confirm:
        result = graph.invoke(Command(resume=req.confirm), config)
        return ChatResponse(reply=_extract_reply(result))

    if not req.message:
        return ChatResponse(reply="Please send a message.", type="message")

    # ── Stream mode ─────────────────────────────────────────────────────
    if req.stream:
        return _stream_response(req.message, config)

    # ── Normal (non-streaming) mode ─────────────────────────────────────
    result = graph.invoke(
        {"messages": [HumanMessage(content=req.message)]},
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


def _stream_response(message: str, config: dict) -> StreamingResponse:
    """Return an SSE stream of token chunks."""

    async def generate():
        final_text = ""
        interrupted = False

        async for event in graph.astream_events(
            {"messages": [HumanMessage(content=message)]},
            config=config,
            version="v2",
        ):
            kind = event["event"]

            if kind == "on_chat_model_stream":
                chunk = event["data"]["chunk"]
                if chunk.content:
                    final_text += chunk.content
                    yield f"data: {json.dumps({'type': 'token', 'content': chunk.content})}\n\n"

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

    uvicorn.run(
        "wedding_agent.server:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )


if __name__ == "__main__":
    main()
