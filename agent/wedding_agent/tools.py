"""LangChain tools the agent can invoke.

When Supabase is configured (``SUPABASE_URL``, ``SUPABASE_SERVICE_ROLE_KEY``,
``SUPABASE_WEDDING_ID`` in ``.env``) the tools query the real database.
Otherwise they return realistic hardcoded stubs so the demo works standalone.
"""

from __future__ import annotations

import json
import re
import urllib.parse
import urllib.request
import uuid as _uuid
from collections import Counter
from html.parser import HTMLParser

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


@tool
def lookup_venues() -> str:
    """Look up venues being considered for the wedding.

    Returns venue names, addresses, capacity, cost, contact info,
    packages, and which venue (if any) is currently selected.
    """
    if not is_live():
        return _stub_venues()

    rows = (
        _sb()
        .table("venues")
        .select("name, address, capacity, cost, contact_name, contact_email, contact_phone, notes, website_url, packages, is_selected")
        .eq("wedding_id", _wid())
        .order("created_at")
        .execute()
        .data
    )

    selected = next((r["name"] for r in rows if r.get("is_selected")), None)

    venues = [
        {
            "name": r["name"],
            "address": r.get("address") or None,
            "capacity": r.get("capacity"),
            "cost": float(r["cost"]) if r.get("cost") else None,
            "contact": {
                "name": r.get("contact_name") or None,
                "email": r.get("contact_email") or None,
                "phone": r.get("contact_phone") or None,
            },
            "website": r.get("website_url") or None,
            "packages": r.get("packages") or [],
            "notes": r.get("notes") or None,
            "selected": bool(r.get("is_selected")),
        }
        for r in rows
    ]

    return json.dumps({
        "total_venues": len(venues),
        "selected_venue": selected,
        "venues": venues,
    })


@tool
def lookup_seating() -> str:
    """Look up the seating arrangement for the wedding.

    Returns tables (name, shape, capacity) and which guests are
    assigned to each table.  Also lists unassigned guests.
    """
    if not is_live():
        return _stub_seating()

    tables = (
        _sb()
        .table("seating_tables")
        .select("id, name, shape, capacity")
        .eq("wedding_id", _wid())
        .order("created_at")
        .execute()
        .data
    )

    guests = (
        _sb()
        .table("guests")
        .select("full_name, table_id, seat_number, rsvp_status")
        .eq("wedding_id", _wid())
        .order("full_name")
        .execute()
        .data
    )

    guests_by_table: dict[str, list] = {}
    unassigned = []
    for g in guests:
        if g.get("table_id"):
            guests_by_table.setdefault(g["table_id"], []).append(g)
        else:
            unassigned.append({"name": g["full_name"], "rsvp": g["rsvp_status"]})

    table_data = []
    for t in tables:
        seated = guests_by_table.get(t["id"], [])
        table_data.append({
            "name": t["name"],
            "shape": t["shape"],
            "capacity": t["capacity"],
            "seated": len(seated),
            "guests": [
                {"name": g["full_name"], "seat": g.get("seat_number")}
                for g in seated
            ],
        })

    total_capacity = sum(t["capacity"] for t in tables)
    total_seated = sum(len(guests_by_table.get(t["id"], [])) for t in tables)

    return json.dumps({
        "total_tables": len(tables),
        "total_capacity": total_capacity,
        "total_seated": total_seated,
        "unassigned_guests": len(unassigned),
        "tables": table_data,
        "unassigned": unassigned,
    })


def _ddg_search(query: str, max_results: int = 10) -> list[dict]:
    """Run a DuckDuckGo HTML search and parse results."""

    class _ResultParser(HTMLParser):
        def __init__(self) -> None:
            super().__init__()
            self.results: list[dict] = []
            self._in_title = False
            self._in_snippet = False
            self._cur: dict = {}

        def handle_starttag(self, tag: str, attrs: list) -> None:
            d = dict(attrs)
            if tag == "a" and "result__a" in d.get("class", ""):
                self._in_title = True
                raw = d.get("href", "")
                m = re.search(r"uddg=([^&]+)", raw)
                self._cur = {"url": urllib.parse.unquote(m.group(1)) if m else raw}
            if tag == "a" and "result__snippet" in d.get("class", ""):
                self._in_snippet = True
                self._cur.setdefault("description", "")

        def handle_data(self, data: str) -> None:
            if self._in_title:
                self._cur["title"] = self._cur.get("title", "") + data
            if self._in_snippet:
                self._cur["description"] = self._cur.get("description", "") + data

        def handle_endtag(self, tag: str) -> None:
            if tag == "a" and self._in_title:
                self._in_title = False
            if tag == "a" and self._in_snippet:
                self._in_snippet = False
                self.results.append(self._cur)
                self._cur = {}

    encoded = urllib.parse.quote(query)
    url = f"https://html.duckduckgo.com/html/?q={encoded}"
    req = urllib.request.Request(url, headers={
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
    })
    resp = urllib.request.urlopen(req, timeout=15)
    html = resp.read().decode()

    parser = _ResultParser()
    parser.feed(html)
    return parser.results[:max_results]


_AGGREGATOR_DOMAINS = {
    "weddingwire.com", "theknot.com", "wedding-spot.com", "zola.com",
    "weddingrule.com", "hitched.co.uk", "bridestory.com",
}


def _is_aggregator(url: str) -> bool:
    try:
        domain = urllib.parse.urlparse(url).netloc.lower().replace("www.", "")
        return any(agg in domain for agg in _AGGREGATOR_DOMAINS)
    except Exception:
        return False


def _get_saved_venue_names() -> list[str]:
    """Return names of venues already saved for this wedding."""
    if not is_live():
        return []
    try:
        rows = (
            _sb()
            .table("venues")
            .select("name")
            .eq("wedding_id", _wid())
            .execute()
            .data
        )
        return [r["name"] for r in rows]
    except Exception:
        return []


@tool
def web_search(query: str) -> str:
    """Search the internet. Use this for any question that needs live web data.

    You can call this multiple times with different queries to refine
    results — e.g. first search broadly, then search for a specific
    venue name to find its website.

    Parameters
    ----------
    query : str
        Any search query. Be specific for better results.
    """
    try:
        results = _ddg_search(query)
    except Exception as exc:
        return json.dumps({"error": f"Search failed: {exc}"})

    if not results:
        return json.dumps({"results": [], "message": "No results found. Try rephrasing."})

    # Separate direct sites from aggregators
    direct = [r for r in results if not _is_aggregator(r.get("url", ""))]
    aggregators = [r for r in results if _is_aggregator(r.get("url", ""))]

    # Include saved venues so the agent can filter duplicates
    saved = _get_saved_venue_names()

    response: dict = {
        "result_count": len(results),
        "direct_results": direct,
        "aggregator_results": aggregators,
    }
    if saved:
        response["already_saved_venues"] = saved
    return json.dumps(response)


@tool
def fetch_page(url: str) -> str:
    """Fetch a webpage and return its text content and images.

    Use this to get detailed information from a URL — prices, capacity,
    descriptions, photos, contact info, etc.  You can call this multiple
    times on different URLs.

    Parameters
    ----------
    url : str
        The URL to fetch.
    """
    try:
        req = urllib.request.Request(url, headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        })
        resp = urllib.request.urlopen(req, timeout=15)
        raw = resp.read().decode("utf-8", errors="replace")
    except Exception as exc:
        return json.dumps({"error": f"Could not fetch page: {exc}"})

    # Extract text
    text = re.sub(r"<script[^>]*>.*?</script>", " ", raw, flags=re.S)
    text = re.sub(r"<style[^>]*>.*?</style>", " ", text, flags=re.S)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text).strip()[:8000]

    # Extract all images — let the agent decide which ones showcase the venue
    images: list[str] = []
    for og in re.findall(r'(?:property|name)="og:image"\s+content="([^"]+)"', raw):
        if og not in images:
            images.append(og)
    for src in re.findall(r'<img[^>]+src="(https?://[^"]+)"[^>]*>', raw):
        if src not in images:
            images.append(src)
        if len(images) >= 15:
            break

    return json.dumps({"url": url, "text": text, "images": images})


# ── Write tools (trigger human-in-the-loop confirmation) ──────────────────


_WRITABLE_TABLES = {
    "guests", "venues", "budget_categories", "budget_expenses",
    "checklist_items", "seating_tables",
}

# Tables that need wedding_id injected on create
_WEDDING_SCOPED = _WRITABLE_TABLES

# Tables where we look up by name (case-insensitive) instead of id
_NAME_LOOKUP_TABLES = {"guests": "full_name", "venues": "name", "budget_categories": "name"}


def _find_record(table: str, identifier: str) -> dict | None:
    """Find a record by id or name (case-insensitive)."""
    # Try UUID first
    try:
        _uuid.UUID(identifier)
        result = _sb().table(table).select("*").eq("id", identifier).execute().data
        if result:
            return result[0]
    except (ValueError, AttributeError):
        pass

    # Try name lookup
    name_col = _NAME_LOOKUP_TABLES.get(table)
    if name_col:
        result = (
            _sb().table(table).select("*")
            .eq("wedding_id", _wid())
            .ilike(name_col, identifier)
            .execute().data
        )
        if result:
            return result[0]

    return None


@tool
def create_record(table: str, data: dict) -> str:
    """Create a new record in a wedding table.

    Parameters
    ----------
    table : str
        Table name: guests, venues, budget_expenses, budget_categories,
        checklist_items, or seating_tables.
    data : dict
        Fields to set. Do NOT include id or wedding_id — those are
        added automatically. For budget_expenses, look up the
        category_id from the category name first using lookup_budget.
    """
    if table not in _WRITABLE_TABLES:
        return json.dumps({"error": f"Unknown table '{table}'. Use one of: {', '.join(sorted(_WRITABLE_TABLES))}"})

    if not is_live():
        return json.dumps({"created": True, "table": table, "data": data})

    row = {**data}
    if table in _WEDDING_SCOPED:
        row["wedding_id"] = _wid()

    # For budget_expenses, resolve category name → id if needed
    if table == "budget_expenses" and "category" in row:
        cat_name = row.pop("category")
        cats = (
            _sb().table("budget_categories").select("id, name")
            .eq("wedding_id", _wid()).ilike("name", cat_name)
            .execute().data
        )
        if not cats:
            return json.dumps({"error": f"No budget category matching '{cat_name}'."})
        row["category_id"] = cats[0]["id"]

    result = _sb().table(table).insert(row).execute().data
    return json.dumps({"created": True, "table": table, "record": result[0] if result else data})


@tool
def update_record(table: str, identifier: str, data: dict) -> str:
    """Update an existing record in a wedding table.

    Parameters
    ----------
    table : str
        Table name: guests, venues, budget_expenses, budget_categories,
        checklist_items, or seating_tables.
    identifier : str
        The record's id (UUID) or name (for guests, venues, categories —
        matched case-insensitively).
    data : dict
        Fields to update. Only include fields you want to change.
    """
    if table not in _WRITABLE_TABLES:
        return json.dumps({"error": f"Unknown table '{table}'. Use one of: {', '.join(sorted(_WRITABLE_TABLES))}"})

    if not is_live():
        return json.dumps({"updated": True, "table": table, "identifier": identifier, "data": data})

    record = _find_record(table, identifier)
    if not record:
        return json.dumps({"error": f"No {table} record found matching '{identifier}'."})

    _sb().table(table).update(data).eq("id", record["id"]).execute()
    return json.dumps({"updated": True, "table": table, "record_id": record["id"], "changes": data})


@tool
def delete_record(table: str, identifier: str) -> str:
    """Delete a record from a wedding table.

    Parameters
    ----------
    table : str
        Table name: guests, venues, budget_expenses, budget_categories,
        checklist_items, or seating_tables.
    identifier : str
        The record's id (UUID) or name (for guests, venues, categories —
        matched case-insensitively).
    """
    if table not in _WRITABLE_TABLES:
        return json.dumps({"error": f"Unknown table '{table}'. Use one of: {', '.join(sorted(_WRITABLE_TABLES))}"})

    if not is_live():
        return json.dumps({"deleted": True, "table": table, "identifier": identifier})

    record = _find_record(table, identifier)
    if not record:
        return json.dumps({"error": f"No {table} record found matching '{identifier}'."})

    _sb().table(table).delete().eq("id", record["id"]).execute()
    name_col = _NAME_LOOKUP_TABLES.get(table)
    display = record.get(name_col, record["id"]) if name_col else record["id"]
    return json.dumps({"deleted": True, "table": table, "record": str(display)})


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


def _stub_venues() -> str:
    return json.dumps({
        "total_venues": 3,
        "selected_venue": "Rosewood Estate",
        "venues": [
            {"name": "Rosewood Estate", "address": "1234 Garden Lane, Napa Valley, CA", "capacity": 200, "cost": 9500, "contact": {"name": "Sarah Miller", "email": "sarah@rosewood.com", "phone": "(707) 555-0123"}, "website": "https://rosewoodestates.com", "packages": [{"name": "Premium", "price": 12000}, {"name": "Standard", "price": 9500}], "notes": "Beautiful outdoor ceremony space", "selected": True},
            {"name": "The Grand Ballroom", "address": "567 Main St, San Francisco, CA", "capacity": 300, "cost": 15000, "contact": {"name": "Tom Richards", "email": "events@granball.com", "phone": "(415) 555-0456"}, "website": None, "packages": [], "notes": "Downtown location, valet parking included", "selected": False},
            {"name": "Sunset Beach Club", "address": "890 Ocean Blvd, Santa Cruz, CA", "capacity": 150, "cost": 7500, "contact": {"name": "Lisa Wong", "email": "lisa@sunsetbc.com", "phone": "(831) 555-0789"}, "website": "https://sunsetbeachclub.com", "packages": [], "notes": "Beachfront ceremony, weather-dependent", "selected": False},
        ],
    })


def _stub_seating() -> str:
    return json.dumps({
        "total_tables": 10,
        "total_capacity": 100,
        "total_seated": 65,
        "unassigned_guests": 33,
        "tables": [
            {"name": "Head Table", "shape": "rectangular", "capacity": 10, "seated": 8, "guests": [{"name": "Emma Wilson", "seat": 1}, {"name": "James Wilson", "seat": 2}]},
            {"name": "Table 1", "shape": "round", "capacity": 10, "seated": 8, "guests": [{"name": "Olivia Chen", "seat": 1}, {"name": "Noah Patel", "seat": 2}]},
            {"name": "Table 2", "shape": "round", "capacity": 10, "seated": 7, "guests": []},
            {"name": "Table 3", "shape": "round", "capacity": 10, "seated": 6, "guests": []},
        ],
        "unassigned": [
            {"name": "Charlotte Davis", "rsvp": "pending"},
            {"name": "Isabella Nguyen", "rsvp": "pending"},
            {"name": "Grace Foster", "rsvp": "pending"},
        ],
        "note": "Showing 4 of 10 tables.",
    })


# ── Tool groups ───────────────────────────────────────────────────────────

read_tools = [lookup_guests, lookup_budget, lookup_checklist, lookup_venues, lookup_seating, web_search, fetch_page]

write_tools = [create_record, update_record, delete_record]
WRITE_TOOL_NAMES = {t.name for t in write_tools}

all_tools = [*read_tools, *write_tools]
