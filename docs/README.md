# CEE 406 — design & engineering standards

Three documents govern how this site is built. All are authoritative; where an
ad-hoc decision conflicts with one of them, the document wins.

| Document | Scope | Status |
|---|---|---|
| [`dashboard-visual-language.md`](dashboard-visual-language.md) | Every dashboard, analytics, reporting, and data-visualization surface. Tokens, layout, components, the 18-chart catalog, `.elx` integration contract. | Authoritative, v1.0 |
| [`loaders.md`](loaders.md) | Every loading, pending, streaming, and progress state. | Authoritative, v1.0 |
| [`chart-standards.md`](chart-standards.md) | The CEE 406 **binding**: how the above is realized against this site's navy/orange identity and its existing `cee-*` component layer. | Authoritative for this repo |

## Reading order

1. **`dashboard-visual-language.md`** — the system itself.
2. **`loaders.md`** — the loading states. Shares the `.elx` scope and the
   `--elx-*` prefix with the above, so the two compose without conflict.
3. **`chart-standards.md`** §B — the repo-specific binding. Read this before
   touching `chartTheme.ts`, `tools.css`, or any tool chart, because it records
   which parts of the system this site adopts verbatim, which it re-binds to
   the UIUC palette, and every deviation with its reason.

## Known deviation from the integration contract

`dashboard-visual-language.md` §0.1 requires all tokens on `.elx` and all
classes prefixed `elx-`. This repo predates that contract and uses a `cee-`
prefix with tokens on `:root` in `src/components/react/tools.css`.

The prefix satisfies the *intent* of the naming rule — there is no collision
risk with the host site, because this **is** the whole site rather than a
widget added to someone else's. The `:root` declaration does not: it is the
one rule whose violation could leak into the rest of the site. See
`chart-standards.md` §B10 for the current state and the migration.
