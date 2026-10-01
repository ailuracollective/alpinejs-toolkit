---
title: Data
---

# Data

Async and remote state. A TanStack-Query-style cache, a family of three pluggable adapters,
and a schema-typed JSON:API client.

<div class="layer-grid">
  <a class="layer-card" href="/plugins/data/json-api/"><h3>JSON:API</h3><p>Schema-typed client, sparse fieldsets.</p></a>
  <a class="layer-card" href="/plugins/data/query/"><h3>Query</h3><p>Query cache with staleTime, retries, mutations.</p></a>
  <a class="layer-card" href="/plugins/data/query-adapter-alpine/"><h3>Query Adapter (Alpine)</h3><p>One of three QueryStateAdapter implementations — backed by Alpine.reactive(), so query state lives in an Alpine-reactive store.</p></a>
  <a class="layer-card" href="/plugins/data/query-adapter-zustand/"><h3>Query Adapter (Zustand)</h3><p>Another QueryStateAdapter implementation — backed by one zustand/vanilla store per handle, so a subscriber outside Alpine can watch every published snapshot.</p></a>
  <a class="layer-card" href="/plugins/data/query-adapter-nanostores/"><h3>Query Adapter (Nanostores)</h3><p>The third QueryStateAdapter implementation — backed by one nanostores atom per handle, holding the snapshot itself, and the smallest peer dependency of the three.</p></a>
</div>
