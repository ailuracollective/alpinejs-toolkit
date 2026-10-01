---
title: Plantilla de Plugin
---

@ailura/alpinejs-plugin-template

Andamiaje copy-paste para paquetes nuevos del toolkit. Es un paquete de demo — nunca
se publica — y trae un ejemplo de un solo archivo (`src/index.ts` más la ampliación
`alpine.d.ts` del store). Cada paquete real crece después desde ahí hasta este cañón:

```plaintext
src/
  index.ts       # solo barrel — re-exports, sin lógica
  types.ts       # contratos públicos + constantes DEFAULT_*_KEY
  controller.ts  # el estado, agnóstico del framework
  plugin.ts      # la guard y el sync hacia Alpine
  events.ts      # el mapa de eventos tipado
  store.ts       # creación del store + sync reactivo (paquetes con store)
```

## Andamiaje de un plugin

```sh
pnpm run new:plugin -- my-plugin
# crea packages/my-plugin desde packages/plugin-template,
# renombra plugin-template → my-plugin y pluginTemplate → myPlugin,
# e imprime la referencia al tsconfig que todavía tenés que agregar a mano.
```

## Checklist del cañón

1. **`index.ts` es solo un barrel.** Re-exporta, no define nada. Si hay lógica ahí,
   algo se está filtrando a la superficie pública.
2. **`types.ts` es la frontera.** Todo lo que un consumidor puede tocar, más los
   `DEFAULT_*_KEY`.
3. **`controller.ts` es dueño del estado.** No importa Alpine, no toca el DOM. Recién en
   `plugin.ts` se conecta con el framework.
4. **`plugin.ts` hace tres cosas, en orden.** Reclamar el nombre con la guarda, sincronizar
   el estado, y devolver el callback. Nada más.
5. **`events.ts` es el mapa de eventos.** Cada evento con su payload tipado, en un solo
   archivo.
6. **`store.ts` es dueño de la proyección del store.** Un paquete que registra un store lo
   crea ahí; `plugin.ts` solo registra el resultado y cablea el sync.

## Checklist pre-merge

- [ ] `package.json`: `type:module`, `sideEffects:false`, `exports` con `types` + `import`, un solo entry, `files:["dist"]`, scripts de `build` / `test` / `typecheck` / `size`.
- [ ] `vite.config.ts`: `deps.neverBundle` con `alpinejs` y el peer de core, para que no terminen en el bundle.
- [ ] `controller.ts`: sin imports de `alpinejs`, sin acceso a `window` / `document`.
- [ ] `plugin.ts`: `guardStore` / `guardMagic` con un `packageName` literal.
- [ ] `index.ts`: barrel puro.
- [ ] Tests: el patrón de `@ailura/alpinejs-testing`, con `start` una vez por archivo y `resume` en cada `beforeEach`.
- [ ] Tamaño dentro del presupuesto de `.size-limit.json`.
- [ ] README y `ARCHITECTURE.md` actualizados.

## Cañón de referencia

El paquete accordion es la implementación de referencia:

```plaintext
packages/accordion/src/
  controller.ts   # AccordionController accesible
  plugin.ts       # factory + guardas + sync reactivo
  types.ts        # options + DEFAULT keys
  store.ts        # creación del store + sync del registro
  events.ts       # eventos tipados
```

## Siguiente

- [Core](/es/plugins/foundation/core/) — el código del que sale el andamiaje.
- [Testing](/es/plugins/foundation/testing/) — el harness con el que validar el paquete.
