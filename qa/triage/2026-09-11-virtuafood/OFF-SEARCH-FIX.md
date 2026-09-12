# Open Food Facts text search — 2026-09-12

## Cause and correction

The app called `/cgi/search.pl` anonymously. OFF confirmed that this legacy endpoint now requires authentication:
https://github.com/openfoodfacts/openfoodfacts-python/issues/496#issuecomment-4865954261

The earlier HTTP 503 classification established the symptom, not the cause. Waiting for an outage to recover was not a sufficient fix.

Text search now uses the public `https://search.openfoodfacts.org/search` endpoint, verified against its live OpenAPI schema at `/openapi.json`. It sends `q`, `langs=nl,en`, the requested nutrition fields, and a bounded page size. Results come from `hits`, not the legacy `products` envelope. Barcode lookup is unchanged. No credentials or backend proxy were added.

Search cache keys have a new namespace to avoid reusing legacy empty results. Provider errors and partial timeout responses are not cached as no matches. Search feedback remains inline below the controls.

## Verification

- New endpoint/response-contract tests failed against the old client and passed after migration.
- Live unauthenticated search for `hagelslag`: HTTP 200.
- Actual mobile TypeScript client, run with Node/tsx and `--conditions=react-native`: `found`, 19 importable drafts, first result `Puur Hagelslag`, 435 kcal per 100 g.
- No device/emulator visual verification performed.

## Device checks

1. Search `hagelslag` in All foods, then press Search Open Food Facts.
2. Open a result and confirm its name, energy, and macros in the import review before saving/logging.
3. Check that a nonsense search shows no matches, and offline failure stays below the header with the keyboard open.
4. Scan a barcode to confirm the unchanged lookup flow still works.
