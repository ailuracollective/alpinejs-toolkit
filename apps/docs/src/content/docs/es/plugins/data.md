---
title: Datos
---

# Datos

Estado asíncrono y remoto. Una cache al estilo TanStack Query, una familia de tres adapters
enchufables y un cliente JSON:API tipado por schema.

<div class="layer-grid">
  <a class="layer-card" href="/es/plugins/data/json-api/"><h3>JSON:API</h3><p>Cliente tipado por schema, sparse fieldsets.</p></a>
  <a class="layer-card" href="/es/plugins/data/query/"><h3>Query</h3><p>Cache de query con staleTime, retries, mutations.</p></a>
  <a class="layer-card" href="/es/plugins/data/query-adapter-alpine/"><h3>Query Adapter (Alpine)</h3><p>Una de las tres implementaciones de QueryStateAdapter — basada en Alpine.reactive(), así que el estado de query vive en un store reactivo de Alpine.</p></a>
  <a class="layer-card" href="/es/plugins/data/query-adapter-zustand/"><h3>Query Adapter (Zustand)</h3><p>Otra implementación de QueryStateAdapter — basada en un store zustand/vanilla por handle, así que un suscriptor fuera de Alpine puede observar cada snapshot publicado.</p></a>
  <a class="layer-card" href="/es/plugins/data/query-adapter-nanostores/"><h3>Query Adapter (Nanostores)</h3><p>La tercera implementación de QueryStateAdapter — basada en un atom de nanostores por handle, que guarda el snapshot mismo, y la dependencia peer más chica de las tres.</p></a>
</div>
