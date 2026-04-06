"""LangChain tools the agent can invoke.

When Supabase is configured (``SUPABASE_URL``, ``SUPABASE_SERVICE_ROLE_KEY``,
``SUPABASE_WEDDING_ID`` in ``.env``) the tools query the real database.
Otherwise they return realistic hardcoded stubs so the demo works standalone.
"""

from __future__ import annotations

import json
from collections import Counter

from langchain_core.tools import tool

from wedding_agent.db import get_client, get_wedding_id, is_live

# ── Helpers ─────────────────────────────────────────────────────────────────


def _sb():
    return get_client()


def _wid():
    return get_wedding_id()


# ── Read tools ──────────────────────────────────────────────────────────────


@tool
def lookup_guests() -> str:
    """Look up the guest list for the current wedding.

    Returns guest count, RSVP breakdown, dietary restriction summary,
    and individual guest records with names, RSVP status, party size,
    and dietary needs.  Always include guest names when the user asks
    who is on the list.
    """
    if not is_live():
        return _stub_guests()

    rows = (
        _sb()
        .table("guests")
        .select("full_name, email, rsvp_status, dietary_restrictions, has_plus_one, plus_one_name, group_name, side")
        .eq("wedding_id", _wid())
        .order("full_name")
        .execute()
        .data
    )

    total = len(rows)
    accepted = sum(1 for r in rows if r["rsvp_status"] == "accepted")
    declined = sum(1 for r in rows if r["rsvp_status"] == "declined")
    pending = sum(1 for r in rows if r["rsvp_status"] == "pending")
    plus_ones = sum(1 for r in rows if r["has_plus_one"])

    # Dietary breakdown
    dietary_counts: dict[str, int] = Counter()
    for r in rows:
        d = (r.get("dietary_restrictions") or "").strip()
        if d:
            dietary_counts[d] += 1

    guests = [
        {
            "name": r["full_name"],
            "rsvp": r["rsvp_status"],
            "dietary": r.get("dietary_restrictions") or None,
            "plus_one": r.get("plus_one_name") or None,
            "group": r.get("group_name") or None,
            "side": r.get("side"),
        }
        for r in rows
    ]

    return json.dumps(
        {
            "total_invited": total,
            "rsvp_accepted": accepted,
            "rsvp_declined": declined,
            "rsvp_pending": pending,
            "plus_ones_expected": plus_ones,
            "dietary_restrictions": dict(dietary_counts),
            "guests": guests,
        }
    )


@tool
def lookup_budget() -> str:
    """Look up budget information for the current wedding.

    Returns total budget, amount spent, and per-category breakdown with
    individual expenses.
    """
    if not is_live():
        return _stub_budget()

    # Get overall budget from weddings table
    wedding = (
        _sb()
        .table("weddings")
        .select("overall_budget")
        .eq("id", _wid())
        .single()
        .execute()
        .data
    )
    overall_budget = float(wedding.get("overall_budget", 0))

    # Get categories
    categories = (
        _sb()
        .table("budget_categories")
        .select("id, name, allocated_amount, sort_order")
        .eq("wedding_id", _wid())
        .order("sort_order")
        .execute()
        .data
    )

    # Get all expenses
    expenses = (
        _sb()
        .table("budget_expenses")
        .select("category_id, description, estimated_cost, actual_cost, is_paid, vendor_name")
        .eq("wedding_id", _wid())
        .execute()
        .data
    )

    # Group expenses by category
    expenses_by_cat: dict[str, list] = {}
    for e in expenses:
        expenses_by_cat.setdefault(e["category_id"], []).append(e)

    total_spent = 0.0
    cat_data = []
    for cat in categories:
        cat_expenses = expenses_by_cat.get(cat["id"], [])
        spent = sum(float(e.get("actual_cost") or e.get("estimated_cost") or 0) for e in cat_expenses)
        total_spent += spent
        paid_count = sum(1 for e in cat_expenses if e.get("is_paid"))

        cat_data.append({
            "name": cat["name"],
            "allocated": float(cat["allocated_amount"]),
            "spent": round(spent, 2),
            "expenses": [
                {
                    "description": e["description"],
                    "amount": float(e.get("actual_cost") or e.get("estimated_cost") or 0),
                    "paid": e.get("is_paid", False),
                    "vendor": e.get("vendor_name") or None,
                }
                for e in cat_expenses
            ],
        })

    return json.dumps(
        {
            "total_budget": overall_budget,
            "total_spent": round(total_spent, 2),
            "remaining": round(overall_budget - total_spent, 2),
            "categories": cat_data,
        }
    )


@tool
def lookup_checklist() -> str:
    """Look up the wedding planning checklist.

    Returns tasks grouped by completion status with time periods.
    """
    if not is_live():
        return _stub_checklist()

    rows = (
        _sb()
        .table("checklist_items")
        .select("title, description, due_date, is_completed, time_period, sort_order")
        .eq("wedding_id", _wid())
        .order("sort_order")
        .execute()
        .data
    )

    completed = [r for r in rows if r["is_completed"]]
    upcoming = [r for r in rows if not r["is_completed"]]

    return json.dumps(
        {
            "completed": len(completed),
            "total": len(rows),
            "upcoming_tasks": [
                {
                    "task": r["title"],
                    "description": r.get("description") or None,
                    "period": r.get("time_period") or None,
                    "due_date": r.get("due_date"),
                    "done": False,
                }
                for r in upcoming
            ],
            "recently_completed": [
                {
                    "task": r["title"],
                    "period": r.get("time_period") or None,
                    "done": True,
                }
                for r in completed[-5:]  # last 5 completed
            ],
        }
    )


# ── Write tools (trigger human-in-the-loop confirmation) ──────────────────


@tool
def update_guest_rsvp(guest_name: str, status: str) -> str:
    """Update the RSVP status for a guest.

    Parameters
    ----------
    guest_name : str
        Full name of the guest.
    status : str
        New RSVP status — one of "accepted", "declined", or "pending".
    """
    if status not in ("accepted", "declined", "pending"):
        return json.dumps({"error": f"Invalid status '{status}'. Use accepted, declined, or pending."})

    if not is_live():
        return json.dumps({
            "updated": True,
            "guest": guest_name,
            "new_status": status,
            "message": f"RSVP for {guest_name} has been updated to '{status}'.",
        })

    # Find the guest by name (case-insensitive)
    matches = (
        _sb()
        .table("guests")
        .select("id, full_name")
        .eq("wedding_id", _wid())
        .ilike("full_name", guest_name)
        .execute()
        .data
    )

    if not matches:
        return json.dumps({"error": f"No guest found with name '{guest_name}'."})

    guest = matches[0]
    _sb().table("guests").update({"rsvp_status": status}).eq("id", guest["id"]).execute()

    return json.dumps({
        "updated": True,
        "guest": guest["full_name"],
        "new_status": status,
        "message": f"RSVP for {guest['full_name']} has been updated to '{status}'.",
    })


@tool
def add_budget_expense(category: str, description: str, amount: float) -> str:
    """Record a new expense against a budget category.

    Parameters
    ----------
    category : str
        Budget category (e.g. "Venue", "Catering", "Flowers").
    description : str
        Short description of the expense.
    amount : float
        Dollar amount of the expense.
    """
    if not is_live():
        return json.dumps({
            "recorded": True,
            "category": category,
            "description": description,
            "amount": amount,
            "message": f"Recorded ${amount:,.2f} expense for '{description}' under {category}.",
        })

    # Find the category by name (case-insensitive)
    cats = (
        _sb()
        .table("budget_categories")
        .select("id, name")
        .eq("wedding_id", _wid())
        .ilike("name", category)
        .execute()
        .data
    )

    if not cats:
        return json.dumps({"error": f"No budget category found matching '{category}'."})

    cat = cats[0]
    _sb().table("budget_expenses").insert({
        "wedding_id": _wid(),
        "category_id": cat["id"],
        "description": description,
        "actual_cost": amount,
        "estimated_cost": amount,
    }).execute()

    return json.dumps({
        "recorded": True,
        "category": cat["name"],
        "description": description,
        "amount": amount,
        "message": f"Recorded ${amount:,.2f} expense for '{description}' under {cat['name']}.",
    })


# ── Stub data (used when Supabase is not configured) ─────────────────────


def _stub_guests() -> str:
    return json.dumps({
        "total_invited": 150,
        "rsvp_accepted": 98,
        "rsvp_declined": 12,
        "rsvp_pending": 40,
        "dietary_restrictions": {"vegetarian": 15, "vegan": 8, "gluten_free": 6, "nut_allergy": 3},
        "plus_ones_expected": 22,
        "guests": [
            {"name": "Emma & James Wilson", "rsvp": "accepted", "dietary": None, "plus_one": None, "group": "Family", "side": "partner1"},
            {"name": "Olivia Chen", "rsvp": "accepted", "dietary": "vegetarian", "plus_one": None, "group": "College Friends", "side": "partner2"},
            {"name": "Liam & Sofia Martinez", "rsvp": "accepted", "dietary": None, "plus_one": None, "group": "Family", "side": "partner1"},
            {"name": "Noah Patel", "rsvp": "accepted", "dietary": "vegan", "plus_one": None, "group": "Work", "side": "partner2"},
            {"name": "Ava & Ethan Brooks", "rsvp": "accepted", "dietary": "gluten_free", "plus_one": None, "group": "Friends", "side": "mutual"},
            {"name": "Charlotte Davis", "rsvp": "pending", "dietary": None, "plus_one": None, "group": "College Friends", "side": "partner1"},
            {"name": "William & Mia Thompson", "rsvp": "accepted", "dietary": None, "plus_one": None, "group": "Family", "side": "partner2"},
            {"name": "Benjamin Lee", "rsvp": "declined", "dietary": None, "plus_one": None, "group": "Work", "side": "partner1"},
            {"name": "Sophia & Alexander Kim", "rsvp": "accepted", "dietary": "nut_allergy", "plus_one": None, "group": "Friends", "side": "mutual"},
            {"name": "Isabella Nguyen", "rsvp": "pending", "dietary": "vegetarian", "plus_one": None, "group": "College Friends", "side": "partner2"},
            {"name": "Lucas & Harper Anderson", "rsvp": "accepted", "dietary": None, "plus_one": None, "group": "Family", "side": "partner1"},
            {"name": "Amelia Garcia", "rsvp": "accepted", "dietary": "vegan", "plus_one": None, "group": "Work", "side": "partner2"},
            {"name": "Henry & Ella Robinson", "rsvp": "accepted", "dietary": None, "plus_one": None, "group": "Friends", "side": "mutual"},
            {"name": "Jack Sullivan", "rsvp": "declined", "dietary": None, "plus_one": None, "group": "Work", "side": "partner1"},
            {"name": "Grace & Owen Foster", "rsvp": "pending", "dietary": None, "plus_one": None, "group": "Family", "side": "partner2"},
        ],
        "note": "Showing 15 of 150 invited guests.",
    })


def _stub_budget() -> str:
    return json.dumps({
        "total_budget": 35_000,
        "total_spent": 22_450,
        "remaining": 12_550,
        "categories": [
            {"name": "Venue", "allocated": 10_000, "spent": 9_500, "expenses": [{"description": "Venue deposit", "amount": 5000, "paid": True, "vendor": "Rosewood Estate"}, {"description": "Venue balance", "amount": 4500, "paid": True, "vendor": "Rosewood Estate"}]},
            {"name": "Catering", "allocated": 8_000, "spent": 6_000, "expenses": [{"description": "Catering deposit", "amount": 6000, "paid": True, "vendor": "Delightful Bites"}]},
            {"name": "Photography", "allocated": 4_000, "spent": 3_500, "expenses": [{"description": "Photo package", "amount": 3500, "paid": True, "vendor": "Captured Moments"}]},
            {"name": "Flowers", "allocated": 3_000, "spent": 1_200, "expenses": [{"description": "Floral deposit", "amount": 1200, "paid": True, "vendor": "Bloom & Petal"}]},
            {"name": "Music/DJ", "allocated": 2_500, "spent": 0, "expenses": []},
            {"name": "Attire", "allocated": 3_500, "spent": 2_250, "expenses": [{"description": "Wedding dress", "amount": 1800, "paid": True, "vendor": None}, {"description": "Alterations", "amount": 450, "paid": False, "vendor": None}]},
            {"name": "Stationery", "allocated": 1_000, "spent": 0, "expenses": []},
        ],
    })


def _stub_checklist() -> str:
    return json.dumps({
        "completed": 18,
        "total": 32,
        "upcoming_tasks": [
            {"task": "Book florist", "description": None, "period": "6-8 months before", "due_date": None, "done": False},
            {"task": "Book DJ/band", "description": None, "period": "6-8 months before", "due_date": None, "done": False},
            {"task": "Plan honeymoon", "description": None, "period": "6-8 months before", "due_date": None, "done": False},
            {"task": "Send invitations", "description": None, "period": "3-4 months before", "due_date": None, "done": False},
            {"task": "Order cake", "description": None, "period": "3-4 months before", "due_date": None, "done": False},
            {"task": "Finalize seating chart", "description": None, "period": "2-3 weeks before", "due_date": None, "done": False},
            {"task": "Confirm all vendors", "description": None, "period": "1-2 weeks before", "due_date": None, "done": False},
            {"task": "Final dress fitting", "description": None, "period": "1-2 weeks before", "due_date": None, "done": False},
        ],
        "recently_completed": [
            {"task": "Book venue", "period": "12+ months before", "done": True},
            {"task": "Set budget", "period": "12+ months before", "done": True},
            {"task": "Book photographer", "period": "10-12 months before", "done": True},
            {"task": "Book caterer", "period": "8-10 months before", "done": True},
            {"task": "Send save-the-dates", "period": "8-10 months before", "done": True},
        ],
    })


# ── Tool groups ───────────────────────────────────────────────────────────

read_tools = [lookup_guests, lookup_budget, lookup_checklist]

write_tools = [update_guest_rsvp, add_budget_expense]
WRITE_TOOL_NAMES = {t.name for t in write_tools}

all_tools = [*read_tools, *write_tools]
