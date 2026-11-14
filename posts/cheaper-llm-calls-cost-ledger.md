---
title: "Making LLM Calls Cheaper Without Making Answers Worse"
date: "2026-11-13"
tags: ["AI", "Python"]
excerpt: "Routing requests by complexity, caching prompts in four places, a per-call cost ledger with reserve-and-settle budgets, and moving background jobs to a lighter model."
---

# Making LLM Calls Cheaper Without Making Answers Worse

An AI assistant that can build datasets, write SQL and run notebooks makes a lot of model calls per request, and most of them are not the one the user sees. There are routing calls, titles, OCR, reranking, chart drafts, log analysis. Each looks cheap on its own. Together they are the bill.

The short version of how I approached it: decide what a request may spend before it starts, meter every provider call against that, cache what repeats, and send background work to a lighter model.

## Route by complexity

Before the agent runs, a router call classifies the request into one of three tiers and picks the tool categories it needs, in one structured-output call:

- **simple**: conversation with no platform action, like greetings or "what chart types exist?";
- **moderate**: a task on one kind of entity, like writing one query or one chart;
- **complex**: work that spans several entity types, like a dashboard or an ETL pipeline.

The tier sets the output token budget; the categories decide which tools the agent gets. Tool definitions are part of every prompt, so fewer tools means a shorter prompt on every step. The router is told that an extra category is cheap and a missing one blocks the user, so it errs toward including. Follow-ups never drop below moderate, so "yes, do it" keeps the tools the task was using.

## Cache what repeats

Most of a prompt is identical across calls: tool definitions, the system prompt, the business context of the workspace. The service places up to four cache points per request, the most the providers allow:

1. after the tool definitions,
2. after the stable system prompt,
3. after the business context,
4. at the end of the latest user message.

The first three are shared by many runs and use the model's longer prefix TTL. The last one covers a single run's conversation and uses a 5-minute TTL. That choice is deliberate. Every read restarts the timer, and the steps of one run are seconds apart, so a 5-minute entry only lapses after a long pause. A one-hour entry would cost twice the base input price on every write instead of 1.25x, to cover pauses that rarely happen.

Caching also changed how I think about limits. Our old raw token rate limiter counted cache reads and writes like any other token, so it penalised exactly the caching that makes runs cheap. I removed it; usage is now limited by money only.

## A ledger for every call

Budgets are set in dollars per user or group over a 30-day window. A chat request goes through three steps:

1. **Reserve.** Before anything runs, the service estimates input tokens (message, history, system prompt, context) and output tokens (from the routed tier), applies a 1.25x overhead, and atomically reserves that cost. If the reservation does not fit, the user gets a clear "you have reached your limit" response with how much is spent and left. Pricing lives in the database, next to the model catalog, not in application code.
2. **Claim per call.** Each provider call inside the run claims an allowance first. The database answers with how many output tokens it is willing to fund, and the call is capped at that. When the remaining budget cannot fund another response, the call is refused before it is sent.
3. **Settle.** When the provider reports usage, the call is settled at actual cost and the unused part of the claim is released. When the run ends, the request is finalized.

```
claim = scope.claim(model, agent_type, est_input, requested_output)
stream = provider.call(max_output_tokens=claim.granted_output)
scope.settle(claim, reported_usage or best_evidence)
```

The failures are the interesting part. If a stream breaks before the provider reports usage, the call is settled from evidence: the input that was sent and the output streamed so far, counted with a local tokenizer. A claim that was granted while the caller was being cancelled is settled at zero, so its allowance is not stuck. A settlement that fails stays reserved rather than being released, because releasing on failure would be a way around the budget. Settlement is shielded from client cancellation, so closing the browser tab does not skip it.

A call that runs outside any budget scope is a bug, but it is still never unbilled: it is charged to the signed-in user under a fallback label and logged as an error. Embeddings, reranking and OCR use the same claim-and-settle path, so the ledger is complete.

Every ledger entry carries the model, the agent type (chat, router, OCR, reranker, log analysis and so on) and the feature that triggered it. That attribution shows where the money goes.

## Background work on a lighter model

With every call tagged, the spend the user never reads directly stands out. Background jobs such as log analysis, conversation titles, OCR and chart drafts were running on the same model as the main chat.

I split the platform's own calls from the user's choice. Each site has a model catalog, a set of named tiers from a fast utility model up to the strongest ones, with their prices and caching behaviour stored as rows in the database, so adding a model is a data change rather than a code change. The tier a user picks in chat is used for their conversation, and the stronger model is used only when someone picks it. Platform background calls run on a lighter model, with the least reasoning effort that model accepts for utility work. Log analysis was the clearest case: moving it to the lighter model cut its cost about 11x in live evaluations.

## What I took away

- **Measure per call, not per request**, tagged by agent type.
- **Reserve before, settle after.**
- **Design for the failure paths**: cancellations, broken streams, failed writes.
- **Do not let a limiter punish caching.** Limit on cost.
- **Use the strongest model where the user reads the output.**
