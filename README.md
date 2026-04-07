# Wedding Planner

A full-stack wedding planning app with **Clementine**, an integrated AI assistant. Manage guests, venues, budgets, seating, and checklists through the UI, or let Clementine handle it for you via chat — she can search the web for venues, manage your guest list, track expenses, and more.

Built with **React** + **Vite** (frontend), **FastAPI** + **LangGraph** (agent), and **Supabase** (database + auth).

---

## Quickstart

### Prerequisites

- Node.js 18+
- Python 3.11+
- An [OpenAI API key](https://platform.openai.com/api-keys)
- A [Tavily API key](https://app.tavily.com/) (free tier: 1,000 searches/month)
- A [Supabase project](https://supabase.com) (for data persistence)
- (Optional) A [LangSmith API key](https://smith.langchain.com/) for tracing

### Setup

```bash
# Install frontend dependencies
npm install

# Install agent dependencies
cd agent
pip install -e .
cd ..

# Configure the agent
cp agent/.env.example agent/.env
# Edit agent/.env with your OPENAI_API_KEY, TAVILY_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
```

### Run

```bash
npm run dev
```

This starts both the frontend (http://localhost:5173) and the agent server (port 8000) together. The frontend proxies agent requests through Vite, so everything is accessed at **http://localhost:5173**.

To run just the frontend: `npm run dev:fe`

### Run evaluations

```bash
cd agent
python -m evals.run_evals
```

Results are pushed to LangSmith. The eval suite covers tool routing, answer quality, multi-step venue search flows, and PII guardrails.

---

## Architecture

### Frontend

React 19 + TypeScript + Tailwind CSS v4 + React Router v7.

**Pages:** Dashboard, Guests, RSVPs, Venues, Seating, Budget, Checklist, Settings

**Clementine Chat Panel:** A resizable slide-in panel accessible from any page via the floating action button or "Ask Clementine" buttons on each section. Features:
- Streaming SSE responses with markdown rendering
- Scrollable image galleries with lightbox viewing
- Human-in-the-loop confirmation dialogs for write operations
- Inline forms for creating/updating records (guests, expenses, etc.)
- File upload support (CSV guest lists, receipt images via GPT-4.1 vision)
- Conversation persistence in Supabase (create, switch, delete conversations)
- Reasoning display showing the agent's tool chain per response
- Page-aware context — Clementine tailors her greeting based on which page you're on
- Proactive insights card on the Dashboard (pending RSVPs, budget alerts, overdue tasks)

### Agent

A LangGraph state machine powered by **GPT-4.1** with ReAct-style reasoning.

```mermaid
graph TD
    START([START]) --> guardrails[guardrails - PII redaction]
    guardrails --> agent[agent - GPT-4.1]
    agent --> route{route_tools}
    route -->|no tool calls| END([END])
    route -->|read tools| read_tools[read_tools]
    route -->|write tools| human_review[human_review - interrupt]
    read_tools --> agent
    human_review -->|approved| write_tools[write_tools]
    human_review -->|rejected| END
    write_tools --> agent
```

The agent iterates through **Thought -> Action -> Observation** loops, calling multiple tools across multiple rounds to build comprehensive answers. For example, a venue search triggers: lookup budget -> lookup guests -> web search -> fetch individual venue pages -> cross-reference -> present curated results with images.

### Authentication

The frontend sends the user's Supabase JWT in the `Authorization` header. The agent server verifies the token, resolves the user's `wedding_id` via the `wedding_members` table, and scopes all tool queries to that wedding. No wedding data is ever passed from the client.

### Data separation

All data tables use `wedding_id` foreign keys. Supabase RLS policies enforce row-level access via a `user_has_wedding_access()` function. The agent uses a service-role key (bypassing RLS) but derives the wedding ID server-side from the authenticated user.

---

## Tools

| Tool | Type | Description |
|------|------|-------------|
| `lookup_guests` | Read | Guest count, RSVP breakdown, dietary restrictions |
| `lookup_budget` | Read | Budget totals and per-category spending |
| `lookup_checklist` | Read | Completed/upcoming planning tasks |
| `lookup_venues` | Read | Saved venues with details and selection status |
| `lookup_seating` | Read | Seating tables, assignments, unassigned guests |
| `web_search` | Read | General-purpose web search (Tavily API) |
| `fetch_page` | Read | Fetch a URL for text content and images |
| `search_wedding_knowledge` | Read (RAG) | Semantic search over wedding advice knowledge base |
| `create_record` | Write | Create a record in any table (guests, venues, expenses, etc.) |
| `update_record` | Write | Update a record by ID or name |
| `delete_record` | Write | Delete a record by ID or name |

Write tools work across all 6 tables (`guests`, `venues`, `budget_expenses`, `budget_categories`, `checklist_items`, `seating_tables`) and trigger a human-in-the-loop confirmation dialog before executing. The agent can also emit inline form blocks to collect structured input from the user before calling write tools.

---

## Evaluations

The eval suite (`agent/evals/`) contains 13 test cases:

| Category | What's checked |
|----------|----------------|
| Tool routing | Agent calls the correct tool for the question |
| Answer quality | Response contains expected facts/keywords |
| Multi-step flows | Venue search calls lookup_venues + web_search + fetch_page in sequence |
| Image presence | Venue results include markdown images |
| PII guardrails | SSN/credit card in input is redacted (emails/phones allowed as guest data) |

Evaluators: `correct_tool`, `answer_contains`, `pii_handled`, `multi_tool_flow`, `min_tool_calls`, `has_images`, `excludes_content`.

---

## Design decisions

**Why a wedding planner?** I recently got engaged and thought it would be fun to build an AI assistant that could actually help me plan my wedding — discovering venues, managing the budget, tracking the guest list, and more. Wedding planning is expensive, stressful, and full of moving parts. An AI that deeply understands what you want, has access to all your wedding data, and is available any time feels like something genuinely valuable — not just a demo project. The domain also happens to be a great fit technically: it has natural read/write separation, a rich knowledge base, and enough structure to demonstrate agentic reasoning without artificial complexity.

**Why separate read/write tool nodes?** Rather than interrupting on every tool call, the graph only pauses for write operations. This keeps the UX fast for lookups while adding a safety gate for mutations — a pattern that maps well to real business apps.

**Why GPT-4.1 over GPT-4o-mini?** The agent uses ReAct-style multi-round reasoning (search -> fetch pages -> cross-reference budget -> present results). GPT-4o-mini took shortcuts and skipped rounds. GPT-4.1 follows multi-step instructions reliably without needing tool-level hacks.

**Why general-purpose web_search + fetch_page instead of specialized venue tools?** Early iterations had rigid tools like `search_venues` and `scrape_venue_page` with baked-in logic. Flexible tools + good ReAct reasoning produces better results — the agent decides how to chain them based on what it learns at each step.

**Why regex for PII, not an LLM?** Regex is deterministic, fast, and has zero cost. Only SSNs and credit cards are redacted — emails and phone numbers are intentionally allowed since they're core wedding planning data (guest contact info). In production I'd layer in a more sophisticated approach (e.g., Presidio) for edge cases.

**Why generic CRUD tools instead of specific ones?** Early versions had `update_guest_rsvp`, `add_budget_expense`, `add_venue` — each hardcoded to one operation. Three generic tools (`create_record`, `update_record`, `delete_record`) cover full CRUD across all 6 tables with less code and more flexibility. The agent's ReAct reasoning handles the specifics.

**Why server-side wedding ID resolution?** The frontend sends the user's Supabase JWT, and the server resolves the wedding ID via `wedding_members`. This prevents a malicious client from querying another user's wedding data, even though the agent uses a service-role key that bypasses RLS.

---

## What I'd improve with more time

- **Richer RAG** — add more knowledge docs, use hybrid search (BM25 + semantic), and add a reranker.
- **Multi-turn eval scenarios** — test conversation flows, not just single-turn Q&A.
- **LLM-as-judge evaluator** — assess answer quality and tone beyond substring matching.
- **Presidio-based PII detection** — more robust than regex for edge cases.
- **Observability dashboard** — surface LangSmith metrics in the UI.

---

## Project structure

```
wedding-planner/
├── src/                            # React frontend
│   ├── components/
│   │   ├── chat/                   # ChatPanel, ChatFab, ChatForm
│   │   ├── layout/                 # AppLayout, Sidebar, Header
│   │   ├── ui/                     # Reusable components
│   │   └── ...                     # Feature components
│   ├── hooks/                      # useChat, useSupabaseQuery
│   ├── lib/                        # chatClient, queries, formatters
│   ├── contexts/                   # AuthContext, WeddingContext, ChatContext
│   ├── pages/                      # Route pages
│   └── types/                      # TypeScript interfaces
├── agent/
│   ├── wedding_agent/
│   │   ├── graph.py                # LangGraph definition
│   │   ├── tools.py                # Read + write tools
│   │   ├── server.py               # FastAPI server (REST + SSE)
│   │   ├── guardrails.py           # PII detection and redaction
│   │   ├── rag.py                  # RAG pipeline
│   │   ├── db.py                   # Supabase client
│   │   └── state.py                # Agent state definition
│   ├── knowledge/                  # Markdown knowledge base for RAG
│   ├── evals/                      # LangSmith evaluation suite
│   ├── pyproject.toml
│   └── Dockerfile
├── supabase/                       # Database migrations
├── vite.config.ts                  # Vite config with agent proxy
└── package.json                    # npm scripts (dev runs both servers)
```
