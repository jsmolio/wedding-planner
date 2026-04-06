"""RAG pipeline — loads the wedding-planning knowledge base into a vector store
and exposes a LangChain tool for semantic search.

The vector store is built lazily on first import so the embedding model is only
called once per process lifetime.
"""

from __future__ import annotations

from pathlib import Path

from langchain_core.documents import Document
from langchain_core.tools import tool
from langchain_core.vectorstores import InMemoryVectorStore
from langchain_openai import OpenAIEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter

KNOWLEDGE_DIR = Path(__file__).resolve().parent.parent / "knowledge"


def _load_knowledge_store() -> InMemoryVectorStore:
    """Read every ``.md`` file under ``knowledge/``, chunk it, and embed."""
    docs: list[Document] = []
    for md_file in sorted(KNOWLEDGE_DIR.glob("*.md")):
        text = md_file.read_text(encoding="utf-8")
        docs.append(Document(page_content=text, metadata={"source": md_file.name}))

    splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)
    chunks = splitter.split_documents(docs)

    embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
    return InMemoryVectorStore.from_documents(chunks, embeddings)


# Module-level singleton — built once, reused across requests.
_store: InMemoryVectorStore | None = None


def _get_store() -> InMemoryVectorStore:
    global _store  # noqa: PLW0603
    if _store is None:
        _store = _load_knowledge_store()
    return _store


@tool
def search_wedding_knowledge(query: str) -> str:
    """Search the wedding-planning knowledge base.

    Use this for questions about etiquette, budgeting tips, planning
    timelines, and general best practices.  Returns the most relevant
    passages from the knowledge base.
    """
    store = _get_store()
    results = store.similarity_search(query, k=3)
    if not results:
        return "No relevant knowledge found."
    return "\n\n---\n\n".join(
        f"[source: {doc.metadata['source']}]\n{doc.page_content}" for doc in results
    )
