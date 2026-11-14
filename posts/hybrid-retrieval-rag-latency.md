---
title: "Cutting RAG Latency from ~10s to Under 1s with Hybrid Retrieval"
date: "2026-11-14"
tags: ["AI", "RAG", "Python"]
excerpt: "Vector and full-text search in one Postgres query, a neural reranker with a hard timeout, and OCR only for the pages that need it."
---

# Cutting RAG Latency from ~10s to Under 1s with Hybrid Retrieval

When a user attaches documents to a chat in our platform, the assistant has to find the few passages that answer the current message and put them in front of the model. The first version of that path took around ten seconds. The version that runs today answers in under a second. Nothing about it is exotic: one hybrid query over pgvector, one rerank call, and a selection step that respects a token budget. Most of the work was in deciding what each step is allowed to cost and what happens when it fails.

## One query, two arms

Every chunk is stored in Postgres with an embedding and a full-text search vector. A single SQL function runs both searches over the same scoped set of chunks: only the documents the user can read, only the ones attached to this conversation.

- The **dense arm** orders chunks by cosine distance to the query embedding (pgvector's `<=>`) and keeps the top 25.
- The **keyword arm** extracts up to 32 terms from the query, finds the chunks that contain each term, and scores them with a BM25-style weight computed over the scoped set, so a word that appears in every chunk counts for almost nothing. It keeps the top 10, and it also returns how many terms matched and whether any of them was rare (present in at most 5% of the chunks).

The two lists are merged with reciprocal rank fusion: `1/(60 + dense rank) + 1/(60 + keyword rank)`. Fusing in the database means one round trip, with candidates already joined to their text, pages and token count.

Embeddings handle paraphrase; keywords handle exact identifiers like an error code, which often have no semantic neighbour.

## Rerank, but with a deadline

Rank fusion is a decent first cut, not a final order. The candidates of each query go to a neural reranker, which scores every passage against the question. Results are then filtered twice: nothing is kept if even the best score is below 0.05, and among the rest only passages within a relative floor of the best one survive. That second rule matters more than it looks. It stops the model from receiving ten loosely related passages just because ten slots were available.

The reranker is the slowest step, so it runs under a 4-second timeout and query embedding runs under a 3-second one. Neither failure is fatal:

- If the embedding times out, the search runs keyword-only with a wider keyword limit (25), and a keyword hit is kept only if it matched at least two terms or one rare term.
- If the rerank times out, the fused order is used as is and the outcome is marked `unranked`.

Every outcome carries a `degraded` flag and per-step timings, so the logs show how often each fallback fires.

## Follow-ups get two queries

A follow-up like "and for last quarter?" is useless as a search query on its own. The service builds a second query by prepending the user's last two distinct requests to the current one, then searches and reranks both queries in parallel.

The interesting part is how the results are combined. The two ranked lists take turns filling the budget: one passage from the message's own list, one from the context list, and so on. A passage about the previous topic can never crowd out the answer to the current message, because each list only gets every other slot.

```
budget = 6000 tokens, max 15 chunks
while any list has hits:
    for list in [own_query_hits, context_query_hits]:
        take the next hit that is new, not a duplicate text, and fits
```

Chunks already delivered earlier are excluded, duplicate text is taken once, and the final selection is re-sorted into document order.

## Chunking that respects structure

The chunker reads a page as units (paragraphs, headings, tables) and packs whole units toward about 400 tokens, capped at 512, so a chunk never ends mid-paragraph unless the paragraph alone is too large. A split table repeats its header when there is room.

## OCR only where it is needed

Scanned PDFs were the other source of bad answers: a page with no usable text layer produces nothing to search. The fix is to decide per page whether to read text or pixels.

A page goes to OCR when:

- its text layer is garbled (more than 10% unreadable characters, which is what a font without a Unicode mapping produces);
- it is mostly images (half the page or more) with fewer than 100 characters of body text;
- or it has no text and no images but hundreds of vector drawing paths, which is how some exporters "print" text.

Those pages are rendered at 150 DPI and transcribed to markdown by a vision model, one call per page, at most 12 pages at a time, each with a 60-second timeout. More than 100 scanned pages is refused up front rather than half-processed.

Extraction itself runs in a child process per upload. A malformed PDF that eats memory or hangs is killed by the operating system or the service, and never takes the chat service down with it.

## What I would tell myself at the start

- **Put the fusion in the database**: one query, already scoped by permissions.
- **Give every remote step a deadline and a fallback**, and record which one ran.
- **Filter by relevance, not by count.**
- **Treat follow-ups as their own retrieval problem.**
- **Decide OCR per page.** Most PDFs are mixed.
