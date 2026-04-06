"""Supabase client for the wedding-planner agent.

When ``SUPABASE_URL``, ``SUPABASE_SERVICE_ROLE_KEY``, and
``SUPABASE_WEDDING_ID`` are set in the environment the agent queries the
real database.  Otherwise, the tools fall back to hardcoded stubs.

The service-role key bypasses Row-Level Security so the agent can read
and write data for any wedding without user-level auth.
"""

from __future__ import annotations

import os

_client = None
_wedding_id: str | None = None


def _is_configured() -> bool:
    return bool(
        os.getenv("SUPABASE_URL")
        and os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        and os.getenv("SUPABASE_WEDDING_ID")
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


def get_wedding_id() -> str:
    """Return the configured wedding ID."""
    global _wedding_id
    if _wedding_id is None:
        _wedding_id = os.environ["SUPABASE_WEDDING_ID"]
    return _wedding_id


def is_live() -> bool:
    """Return True if Supabase is configured and available."""
    return _is_configured()
