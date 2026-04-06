"""PII detection and redaction guardrails.

Scans user messages for common PII patterns (emails, phone numbers, SSNs,
credit-card numbers) and replaces them with safe placeholders before the
message reaches the LLM.
"""

from __future__ import annotations

import re

# ── Patterns ────────────────────────────────────────────────────────────────

# Only redact truly sensitive PII. Emails and phone numbers are
# expected in a wedding planner (guest contact info) and should not
# be redacted.
_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("[REDACTED_SSN]", re.compile(r"\b\d{3}-\d{2}-\d{4}\b")),
    ("[REDACTED_CARD]", re.compile(r"\b(?:\d[ -]*?){13,19}\b")),
]


def redact_pii(text: str) -> tuple[str, list[str]]:
    """Replace PII in *text* with safe placeholders.

    Returns
    -------
    redacted : str
        The text with PII replaced.
    found_types : list[str]
        Placeholder labels for each PII type that was detected
        (e.g. ``["[REDACTED_EMAIL]", "[REDACTED_PHONE]"]``).
    """
    found: list[str] = []
    for label, pattern in _PATTERNS:
        if pattern.search(text):
            text = pattern.sub(label, text)
            found.append(label)
    return text, found
