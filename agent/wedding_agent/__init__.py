from pathlib import Path

from dotenv import load_dotenv

# Ensure .env is loaded before any LangChain imports.
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from wedding_agent.graph import graph, memory  # noqa: E402

__all__ = ["graph", "memory"]
