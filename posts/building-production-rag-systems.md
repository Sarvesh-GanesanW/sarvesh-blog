---
title: "Building Production RAG Systems: Lessons from 10K+ Daily Queries"
date: "2025-01-15"
tags: ["AI", "RAG", "Python", "Tutorial"]
excerpt: "How we reduced RAG query latency from 2.5s to 400ms while scaling to handle thousands of daily queries in production."
---

# Building Production RAG Systems: Lessons from 10K+ Daily Queries

When we first deployed our Retrieval-Augmented Generation (RAG) system to production, we quickly discovered that academic benchmarks don't tell the full story. Real users have real expectations around latency, accuracy, and cost.

In this article, I'll share the key lessons learned from scaling a RAG system to handle over 10,000 queries per day while reducing latency by 84% and cutting costs by 60%.

## The Problem: Academic RAG vs Production RAG

Our initial implementation was textbook RAG:

```python
def simple_rag(query: str) -> str:
    # Embed the query
    query_embedding = embed_text(query)

    # Search vector database
    docs = vector_db.search(query_embedding, k=5)

    # Generate response
    context = "\n".join([doc.text for doc in docs])
    prompt = f"Context: {context}\n\nQuestion: {query}"
    response = llm.generate(prompt)

    return response
```

**Initial metrics:**
- **Latency:** 2.5 seconds (P95)
- **Cost per query:** $0.008
- **Accuracy:** 72% (measured by user feedback)

These numbers were unacceptable for production.

## Optimization 1: Hybrid Search

The first major improvement came from implementing hybrid search combining semantic and keyword search.

```python
def hybrid_search(query: str, alpha: float = 0.7):
    # Semantic search
    semantic_results = vector_db.search(query, k=10)

    # Keyword search (BM25)
    keyword_results = bm25_index.search(query, k=10)

    # Merge with reciprocal rank fusion
    merged = reciprocal_rank_fusion(
        semantic_results,
        keyword_results,
        alpha=alpha
    )

    return merged[:5]
```

**Impact:**
- Latency improved by only 5%
- Accuracy jumped from 72% to 81%

## Optimization 2: Caching Strategy

We implemented a three-tier caching system:

1. **Exact match cache** (Redis) - 15% hit rate
2. **Semantic similarity cache** - 25% hit rate
3. **Partial result cache** - 10% hit rate

```python
class RAGCache:
    def __init__(self):
        self.redis_client = redis.Redis()
        self.similarity_threshold = 0.95

    def get(self, query: str):
        # Check exact match
        cached = self.redis_client.get(f"rag:{query}")
        if cached:
            return json.loads(cached)

        # Check semantic similarity
        query_emb = embed_text(query)
        similar = self.find_similar_cached(query_emb)

        if similar and similar['score'] > self.similarity_threshold:
            return similar['response']

        return None
```

**Impact:**
- 50% of queries served from cache
- Latency reduced to 800ms (P95) for cache hits
- Cost reduced by 45%

## Optimization 3: Async Document Retrieval

We parallelized the retrieval process:

```python
async def parallel_retrieval(query: str):
    async with asyncio.TaskGroup() as tg:
        task1 = tg.create_task(vector_db.search(query))
        task2 = tg.create_task(bm25_index.search(query))
        task3 = tg.create_task(keyword_expansion(query))

    # Merge results
    merged = merge_results([task1.result(), task2.result()])
    return merged
```

**Impact:**
- Reduced retrieval time from 600ms to 200ms
- Overall latency down to 1.1s (P95)

## Optimization 4: Smart Chunking

We discovered that our initial chunk size (512 tokens) was suboptimal.

**Experiment results:**

| Chunk Size | Accuracy | Latency | Context Quality |
|------------|----------|---------|-----------------|
| 256        | 79%      | 850ms   | Low             |
| 512        | 81%      | 1100ms  | Medium          |
| 1024       | 85%      | 1800ms  | High            |
| Adaptive   | 86%      | 900ms   | High            |

We implemented adaptive chunking based on content type:

```python
def adaptive_chunk(document: str, doc_type: str):
    if doc_type == "code":
        # Chunk by function/class
        return chunk_by_ast(document)
    elif doc_type == "article":
        # Chunk by semantic paragraphs
        return chunk_by_semantics(document)
    else:
        # Default: sliding window
        return chunk_sliding_window(document, size=768)
```

## Optimization 5: Prompt Optimization

We reduced prompt tokens by 40% without sacrificing quality:

**Before:**
```python
prompt = f"""You are a helpful AI assistant. Given the context below, answer the user's question accurately and concisely.

Context:
{context}

Question: {query}

Instructions:
- Only use information from the context
- If you don't know, say so
- Be concise but complete

Answer:"""
```

**After:**
```python
prompt = f"""Context: {context}

Q: {query}
A:"""
```

## Final Results

After implementing all optimizations:

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Latency (P95) | 2.5s | 400ms | **84% ↓** |
| Cost/query | $0.008 | $0.003 | **62% ↓** |
| Accuracy | 72% | 86% | **14% ↑** |
| Cache hit rate | 0% | 50% | **50% ↑** |

## Key Takeaways

1. **Hybrid search > Pure semantic search** - Combining methods gives best results
2. **Caching is essential** - 50% hit rate saved us thousands in API costs
3. **Async everything** - Parallel operations unlock major speedups
4. **Adaptive chunking** - One size doesn't fit all content types
5. **Simple prompts work** - Shorter prompts = faster responses

## Next Steps

We're currently experimenting with:
- **Query rewriting** - Reformulating user queries for better retrieval
- **Re-ranking models** - Using cross-encoders to improve result quality
- **Streaming responses** - Reducing perceived latency
- **Multi-hop reasoning** - For complex queries requiring multiple retrieval steps

## Code Repository

The full implementation is available on GitHub: [AMSR_RAG](https://github.com/Sarvesh-GanesanW/AMSR_RAG)

---

*Have questions or suggestions? Reach out on [LinkedIn](https://linkedin.com/in/sarvesh-ganesan09) or [GitHub](https://github.com/Sarvesh-GanesanW).*
