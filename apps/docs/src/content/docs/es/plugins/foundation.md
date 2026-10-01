---
title: Fundamentos
---

# Fundamentos

La infraestructura sobre la que se construye cada otra capa. Estos
paquetes no siempre son plugins de Alpine en sí — `core` y `ui` se consumen por
subpaths granulares, `state-machine` es un controlador puro, y `testing` es solo de
desarrollo.

<div class="layer-grid">
  <a class="layer-card" href="/es/plugins/foundation/core/"><h3>Core</h3><p>BaseController, guardas, ids, singletons, helpers de env.</p></a>
  <a class="layer-card" href="/es/plugins/foundation/plugin-template/"><h3>Plugin Template</h3><p>Andamiaje para paquetes nuevos.</p></a>
  <a class="layer-card" href="/es/plugins/foundation/state-machine/"><h3>State Machine</h3><p>Grafo de transiciones de N estados con guardas.</p></a>
  <a class="layer-card" href="/es/plugins/foundation/testing/"><h3>Testing</h3><p>Helpers de tests de integración con Alpine.</p></a>
  <a class="layer-card" href="/es/plugins/foundation/ui/"><h3>UI</h3><p>Adaptadores de storage, helpers de portal, primitivas de media.</p></a>
</div>
