"""LangSmith evaluation runner for the wedding-planner agent.

Usage
-----
    cd agent
    python -m evals.run_evals

This script:
1. Creates (or reuses) a LangSmith dataset called ``wedding-planner-evals``.
2. Runs every example through the agent graph.
3. Evaluates with custom scorers:
   - **correct_tool** – did the agent call the expected tool?
   - **answer_contains** – does the final answer include expected content?
   - **pii_redacted** – for guardrails tests, was PII removed from the response?
4. Prints a summary table and pushes results to LangSmith.
"""

from __future__ import annotations

import json
import uuid
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from langchain_core.messages import HumanMessage  # noqa: E402
from langsmith import Client, evaluate  # noqa: E402

from wedding_agent.graph import graph  # noqa: E402

DATASET_NAME = "wedding-planner-evals"
DATASET_PATH = Path(__file__).resolve().parent / "dataset.json"


# ── Target function ─────────────────────────────────────────────────────────


def predict(inputs: dict) -> dict:
    """Run the agent on a single example and return outputs for scoring."""
    # Each eval example gets its own thread to avoid state leakage
    thread_id = f"eval-{uuid.uuid4()}"
    result = graph.invoke(
        {"messages": [HumanMessage(content=inputs["question"])]},
        config={
            "configurable": {"thread_id": thread_id},
            "run_name": "eval_run",
            "tags": ["eval"],
        },
    )
    messages = result["messages"]

    # Collect tool names the agent called
    tools_called: list[str] = []
    for msg in messages:
        for tc in getattr(msg, "tool_calls", []) or []:
            tools_called.append(tc["name"])

    final_answer = messages[-1].content

    # Check if PII was redacted (guardrails test)
    pii_in_answer = any(
        marker in final_answer
        for marker in ["[REDACTED_EMAIL]", "[REDACTED_PHONE]", "[REDACTED_SSN]"]
    )

    return {
        "answer": final_answer,
        "tools_called": tools_called,
        "pii_redacted": pii_in_answer or "redact" in final_answer.lower(),
    }


# ── Evaluators ──────────────────────────────────────────────────────────────


def correct_tool(outputs: dict, reference_outputs: dict) -> bool:
    """Score 1 if the agent called the expected tool at least once."""
    expected = reference_outputs.get("expected_tool", "")
    if not expected:
        return True
    return expected in outputs.get("tools_called", [])


def answer_contains(outputs: dict, reference_outputs: dict) -> bool:
    """Score 1 if the final answer contains the expected substring (case-insensitive)."""
    expected = reference_outputs.get("reference_contains", "")
    if not expected:
        return True
    return expected.lower() in outputs.get("answer", "").lower()


def pii_handled(outputs: dict, reference_outputs: dict) -> bool:
    """Score 1 if PII was properly redacted (only scored for guardrails tests)."""
    if not reference_outputs.get("test_guardrails"):
        return True  # Not a guardrails test — auto-pass
    return outputs.get("pii_redacted", False)


# ── Dataset setup ───────────────────────────────────────────────────────────


def ensure_dataset(client: Client) -> str:
    """Create the LangSmith dataset if it doesn't exist, return its name."""
    datasets = list(client.list_datasets(dataset_name=DATASET_NAME))
    if datasets:
        dataset = datasets[0]
    else:
        dataset = client.create_dataset(dataset_name=DATASET_NAME)

    # Upsert examples
    raw = json.loads(DATASET_PATH.read_text())
    existing = list(client.list_examples(dataset_id=dataset.id))

    if len(existing) < len(raw):
        for ex in raw:
            client.create_example(
                inputs={"question": ex["input"]},
                outputs={
                    "expected_tool": ex["expected_tool"],
                    "reference_contains": ex["reference_contains"],
                    "test_guardrails": ex.get("test_guardrails", False),
                },
                dataset_id=dataset.id,
            )

    return DATASET_NAME


# ── Main ────────────────────────────────────────────────────────────────────


def main() -> None:
    client = Client()
    dataset_name = ensure_dataset(client)

    results = evaluate(
        predict,
        data=dataset_name,
        evaluators=[correct_tool, answer_contains, pii_handled],
        experiment_prefix="wedding-planner",
    )
    print(results)


if __name__ == "__main__":
    main()
