"""Supabase client for the wedding-planner agent.

When ``SUPABASE_URL`` and ``SUPABASE_SERVICE_ROLE_KEY`` are set in the
environment the agent queries the real database.  Otherwise, the tools
fall back to hardcoded stubs.

The wedding ID is passed per-request from the frontend (via the graph's
``wedding_id`` state key) rather than being hardcoded in the environment.
"""

from __future__ import annotations

import os

_client = None

# Per-request wedding ID set by the server before invoking the graph.
# NOTE: This is a module-level global rather than a contextvars.ContextVar
# because graph.invoke(Command(resume=...)) runs tools synchronously in a
# context that doesn't inherit the async request's ContextVar. With a single
# uvicorn worker (reload mode), this is safe. For production with multiple
# concurrent requests, switch to passing wedding_id through graph state.
_current_wedding_id: str | None = None


def _is_configured() -> bool:
    return bool(
        os.getenv("SUPABASE_URL")
        and os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    )


def get_client():
    """Return a Supabase client (lazy-init, cached)."""
    global _client
    if _client is None:
        from supabase import create_client

        _client = create_client(
            os.environ["SUPABASE_URL"],
            os.environ["SUPABASE_SERVICE_ROLE_KEY"],
        )
    return _client


def set_wedding_id(wedding_id: str) -> None:
    """Set the wedding ID for the current request."""
    global _current_wedding_id
    _current_wedding_id = wedding_id


def get_wedding_id() -> str:
    """Return the wedding ID for the current request."""
    wid = _current_wedding_id
    if not wid:
        # Fall back to env var for evals / standalone usage
        wid = os.getenv("SUPABASE_WEDDING_ID", "")
    if not wid:
        raise RuntimeError("No wedding_id provided")
    return wid


def is_live() -> bool:
    """Return True if Supabase is configured and a wedding ID is available."""
    if not _is_configured():
        return False
    try:
        get_wedding_id()
        return True
    except RuntimeError:
        return False
