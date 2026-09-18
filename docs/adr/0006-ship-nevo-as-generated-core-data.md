# Ship NEVO as a generated read-only core dataset

The standard Nutrition food library ships as one generated, schema-validated JSON artifact in `@workouts/core`. Generation combines the unchanged NEVO 2025/9.0 extract, a hand-authored bilingual promotion overlay, and an append-only internal-ID lockfile. Runtime clients read this data but never mutate it; correcting a shipped food creates a Personal Food fork.

We chose this design because NEVO supplies a broad Dutch food table with English names and per-100 values, works offline, and avoids a new catalogue service. Generation keeps source extraction and human additions auditable. Application IDs remain stable even though NEVO codes may retire and later reactivate. A changed or returning source code must be explicitly reconciled during generation rather than silently inheriting identity.

NEVO's licence is a live constraint: source attribution and clearly marked Appelent additions accompany calculation output, and the dataset must be removed or separately relicensed before users are charged for a product that includes it.

## Considered options

- **Hand-author a small list** — rejected: it produces avoidable coverage gaps and duplicates an authoritative national dataset.
- **Use Open Food Facts as the shipped list** — rejected: it is oriented toward branded products and an extracted bundled database carries ODbL obligations; it remains an explicit runtime import provider instead.
- **Serve the catalogue from Convex** — rejected for v1: it adds network and backend dependencies to ordinary logging without a need for server-side mutation.
- **Use NEVO code as application identity** — rejected: code reuse/reactivation is proven and no permanent non-reuse guarantee exists.

## Addendum (2026-09): a second shipped source

The artifact now also carries Lidl's bake-off range (65 products, `data/lidl/lidl-bakeoff.json`), transcribed once by hand from Lidl's own ingredient sheets. A further source is admitted on three conditions, all of which the generator enforces: it has its own code namespace (`${source}:${code}`; ids minted as `shipped:<source>-…`), its own entry in the artifact's `sources` table (dataset, edition, whether salt is derived), and its figures ship unchanged with Appelent additions (English names, categories, emoji, servings) kept visibly separate — the same shape as the NEVO overlay split. Lidl foods are promoted by default because the range is small and branded; NEVO rows still earn promotion through the overlay.

The NEVO licence is untouched by this: NEVO data still ships unchanged and attributed. Lidl's terms and the attribution wording for mixed totals are **not yet settled** and must be before this reaches production.
