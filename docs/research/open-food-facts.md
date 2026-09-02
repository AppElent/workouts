# Open Food Facts — API, licensing, limits, mapping, and whether a dataset could be the shipped list

Research for [#54](https://github.com/AppElent/workouts/issues/54), a child of the Fuel
wayfinder map [#51](https://github.com/AppElent/workouts/issues/51). Every claim below is
sourced; where a fact was checked by calling the live API, the request is shown. All live
probes were run on 2026-09-02 with a compliant `User-Agent`.

The two questions the ticket asks to close on are answered at the bottom:
**call OFF from the phone**, and **do not derive the shipped standard-food list from OFF**.

---

## 1. The API as it stands today

### Versions

v3 is current and **v2 is documented as deprecated** — "✅ Current — recommended for all new
integrations" against v2's "⚠️ Deprecated — still supported for backward compatibility"
([API introduction](https://openfoodfacts.github.io/openfoodfacts-server/api/)). This has moved
since gather's `convex/lib/offFetch.ts` was written: gather calls `/api/v2/product/{barcode}.json`.

Hosts:

| Purpose | Host |
| --- | --- |
| Production API | `https://world.openfoodfacts.org` |
| Staging | `https://world.openfoodfacts.net` (HTTP basic auth `off` / `off`) |
| Full-text search | `https://search.openfoodfacts.org` (Search-a-licious — a **separate service**) |

### Barcode lookup

`GET https://world.openfoodfacts.org/api/v3/product/{barcode}.json?fields=…`

`fields` is honoured — a request for `code,product_name,product_name_nl,brands,serving_size,serving_quantity`
returned only the fields that exist:

```json
{"code":"3017624010701","errors":[],"product":{"brands":"Ferrero","code":"3017624010701","product_name":"Nutella"},"result":{…},"status":"success","warnings":[…]}
```

**The not-found signal changed between v2 and v3, and it is the single biggest porting hazard
if gather's code is copied.** Probed live:

| | v2 | v3 |
| --- | --- | --- |
| HTTP status for a missing product | `200` | `404` |
| Body | `{"code":"00000000","status":0,"status_verbose":"no code or invalid code"}` | `{"status":"failure","result":{"id":"product_not_found",…},"errors":[{…"message":{"id":"invalid_code"}},{…"message":{"id":"product_not_found"}}],"warnings":[…]}` |
| Success marker | `status: 1` (number) | `status: "success"` (string) |

Gather's `mapOffProduct` gates on `response.status !== 1`. Against v3 that check rejects
**every** response, and `fetchOffProduct`'s `if (!response.ok) return null` would already have
swallowed the 404 first — so a naive port fails closed rather than misbehaving, but it fails.
Port target: treat HTTP 404 and `status !== "success"` as not-found, and read `result.id` for
the reason.

### Text search

Full-text search is **not** part of the REST product API. The docs say so explicitly for v2
("users should use Search-a-licious"), and gather learned it the expensive way — its comment
records that `/api/v2/search` "silently ignores an unrecognized `search_terms` param (returning
an unfiltered, identical-every-time page of the whole catalog rather than an error, which is what
shipped here originally)".

`GET https://search.openfoodfacts.org/search?q=…&langs=…&page_size=…&fields=…`

Different host, different response shape (`{hits: […], page, page_size, page_count, …}`), and
`brands` comes back as an **array** there while the product API returns a **comma-joined string**.
Both shapes confirmed live; gather's `firstBrand` handles exactly this.

The `langs` parameter is load-bearing: the debug output of a `langs=nl` query shows the query
being built against `product_name.nl`, `generic_name.nl`, `categories.nl`, `labels.nl`. Absent it,
the service searches English — gather's bug where it "searched English and displayed Dutch, so a
Dutch product name found nothing".

### Other observations from the live probes

- `access-control-allow-origin: *`, and `User-Agent` / `X-User-Agent` are both in
  `access-control-allow-headers` — the API is callable from a browser as well as from a phone.
- No `RateLimit-*` response headers are sent; you find out you are over the limit by being
  refused, not by being warned.
- Search queries are slow: an aggregate `states_tags` count took ~8s.

---

## 2. Rate limits and the User-Agent policy

Quoted from the [API introduction](https://openfoodfacts.github.io/openfoodfacts-server/api/):

- **"15 req/min/IP address for all read product queries (`GET /api/*/product` requests or product page)"**
- **"10 req/min/IP address for all search queries (`GET /api/*/search`)"**
- Exceeding them can get the IP **banned**; a global cross-IP limit returns HTTP 503.
- **"always use a custom User-Agent to identify your app (to not risk being identified as a bot).
  The User-Agent should be in the form of `AppName/Version (ContactEmail)`"**
- **"If you need to fetch more than a few hundred products, we ask you to download the data as a
  CSV or JSONL file directly."**
- **"If you expect your app to generate a lot of API traffic, we strongly encourage you to host a
  local instance of Product Opener … and use the daily exports to update your local database."**

And the sentence that decides this ticket's first question:

> **"If your requests come from your users directly (ex: mobile app), the rate limits apply per user."**

That is OFF telling mobile apps to call directly. The limits are per source IP, so a phone gets its
own bucket of 15 lookups and 10 searches per minute — generous for a human scanning barcodes, and
impossible for one user to exhaust on another's behalf.

A server-side proxy inverts this. Convex actions egress from Convex-controlled infrastructure whose
IPs we neither know nor own, shared with every other tenant on that infrastructure; every one of our
users' lookups funnels into whatever bucket that IP has, alongside strangers' traffic. The failure
mode is not "slower" — it is an **IP ban that takes the feature down for the entire app at once**,
and possibly one we did not cause alone. Gather accepts this because it is one household's traffic.

Two honest caveats against the direct call:

- **Carrier-grade NAT.** "Per user" is OFF's shorthand for "per IP". Mobile users behind CGNAT share
  a public IP with many strangers, and heavy public-Wi-Fi or corporate NAT is the same story. So the
  per-user bucket is a best case, not a guarantee — the client must handle 429/503 gracefully rather
  than assume headroom.
- **Privacy.** A direct call shows OFF the user's IP and what they scanned. A proxy hides it. Worth
  one line in a privacy policy either way; not, on its own, a reason to build the proxy.

Note that `User-Agent` is **not** on the Fetch spec's [forbidden request-header
list](https://fetch.spec.whatwg.org/) (the list is `Accept-Charset`, `Accept-Encoding`,
`Access-Control-Request-*`, `Connection`, `Content-Length`, `Cookie`, `Cookie2`, `Date`, `DNT`,
`Expect`, `Host`, `Keep-Alive`, `Origin`, `Referer`, `Set-Cookie`, `TE`, `Trailer`,
`Transfer-Encoding`, `Upgrade`, `Via`, plus `proxy-*`/`sec-*`). So compliance with the UA policy is
not a reason to need a server, on the phone or on the web. React Native's `fetch` is not
browser-sandboxed at all and sets the header verbatim — but this is the one claim here worth
re-verifying on device rather than taking on trust, since it is trivially checkable and
non-compliance is what gets an app banned.

---

## 3. Licensing

**This is the finding that should be read carefully.** The short version: importing into a user's
own diary is clearly fine with attribution; **shipping OFF-derived rows as a code constant is a
Derivative Database and carries obligations that make it the wrong foundation for #55.**

### What OFF says

From [Terms of use, contribution and re-use](https://world.openfoodfacts.org/terms-of-use):

- The **database** is under the [Open Database License (ODbL) 1.0](https://opendatacommons.org/licenses/odbl/1-0/).
- The **individual contents** are under the [Database Contents License (DbCL) 1.0](https://opendatacommons.org/licenses/dbcl/1.0/).
- **Product images** are CC-BY-SA 3.0 — a *different* licence with its own share-alike, and OFF warns
  that "the image licence covers only the photograph itself"; packaging design, logos and trademarks
  are third-party rights it cannot grant.
- Reusers "have to mention the licence and to attribute the authorship to Open Food Facts with a link
  to https://openfoodfacts.org … or the product page, when the information and data reproduced or
  re-used pertain to a specific product." This applies to derivative works too.

Commercial and closed-source use is permitted; the conditions are attribution and share-alike, not
openness of the application.

### What ODbL 1.0 actually obliges (quoted from the licence text)

The relevant definitions:

- **Derivative Database** — "a database based upon the Database, and includes any translation,
  adaptation, arrangement, modification, or any other alteration of the Database or of a Substantial
  part of the Contents."
- **Produced Work** — "a work (such as an image, audiovisual material, text, or sounds) resulting from
  using the whole or a Substantial part of the Contents (via a search or other query)".
- **Substantial** — "substantial in terms of quantity or quality or a combination of both. **The
  repeated and systematic Extraction or Re-utilisation of insubstantial parts of the Contents may
  amount to the Extraction or Re-utilisation of a Substantial part of the Contents.**"
- **Publicly** — "to Persons other than You or under Your control".

The conditions:

- **§4.3 Notice for using output.** Using a Produced Work does not require §4.2's full notice, but if
  you Publicly Use it "You must include a notice … reasonably calculated to make any Person that uses,
  views, accesses, interacts with, or is otherwise exposed to the Produced Work aware that Content was
  obtained from the Database … and that it is available under this License." The licence supplies the
  wording: *"Contains information from DATABASE NAME, which is made available here under the Open
  Database License (ODbL)."*
- **§4.4 Share alike.** "Any Derivative Database that You Publicly Use must be only under the terms of:
  i. This License; ii. A later version …; or iii. A compatible license." And, decisively for us:
  **"§4.4(b) For the avoidance of doubt, Extraction or Re-utilisation of the whole or a Substantial
  part of the Contents into a new database is a Derivative Database and must comply with Section 4.4."**
- **§4.5 Limits of share alike.** Creating a Produced Work "does not create a Derivative Database for
  purposes of Section 4.4", and "Use of a Derivative Database internally within an organisation is not
  to the public and therefore does not fall under the requirements of Section 4.4."
- **§4.6 Access to Derivative Databases.** If you Publicly Use a Derivative Database *or a Produced Work
  from one*, "You must also offer to recipients … a copy in a machine readable form of: a. The entire
  Derivative Database; or b. A file containing all of the alterations made" — "free of charge if
  distributed over the internet."
- **§4.7(a)** forbids imposing technological measures that restrict the rights the licence grants.

### Applying it to the two cases

**Case A — a user imports a scanned product into their diary.** The app queries OFF, shows the result,
the user saves it and the diary entry snapshots the figures (#51's settled premise). This is the
paradigm §4.3 case: a query producing output shown to a person. §4.5(b) says it does not create a
Derivative Database, so **no share-alike obligation attaches to the app or to Convex**. What is required
is the §4.3 notice and OFF's attribution: any screen showing OFF-sourced figures — the search results,
the confirm screen, and arguably the diary entry detail for an OFF-sourced food — carries
"Contains information from Open Food Facts, made available under the ODbL", both words linked.
That is cheap and should simply be built in from the first screen.

Caveat on volume: §4.5(b) protects *querying*. A cache of OFF responses inside Convex, if it grew into
a general mirror rather than a request cache, starts looking like a Derivative Database; §4.5(c) keeps
purely internal use out of §4.4, but "internal" stops applying the moment the cache is what serves users.
A short-TTL request cache is fine; a permanent local mirror is a different legal object and should be
treated as one.

**Case B — shipping a curated set of OFF rows as a code constant in `@workouts/core`.** This is
Extraction of Contents into a new database. §4.4(b) removes the argument that a hand-picked few
hundred rows is merely "output": extraction into a new database *is* a Derivative Database, and the
Substantial definition explicitly folds in "repeated and systematic Extraction … of insubstantial
parts". Publishing an app containing that file is Publicly Using it. Therefore:

1. **The extracted data must be licensed ODbL** (or a compatible licence). Note what this does *and does
   not* reach: ODbL attaches to the database — the file of rows — not to the surrounding application code.
   The app can stay closed-source. But the constant is no longer "just a TypeScript file we own"; it is an
   ODbL-licensed artefact that happens to be written in TypeScript syntax, and every downstream consumer of
   `@workouts/core` inherits that.
2. **§4.6 requires offering every user a machine-readable copy** of that derivative database, free, over
   the internet. A `.ts` constant compiled into an app bundle is arguably not "machine readable form" in
   the sense meant, so this means publishing a JSON/CSV of the list somewhere public and linking to it.
3. **Attribution and licence notice** must travel with it (§4.2 for the file, §4.3 for the screens).
4. **§4.7(a)** sits awkwardly with app-store distribution of an encrypted/signed bundle as the *only*
   copy — which is exactly what obligation 2 exists to relieve, and another reason the separate public
   copy is not optional.
5. **Product images cannot come along on the same terms.** They are CC-BY-SA with per-image contributor
   attribution and third-party packaging rights on top. A shipped list should carry no OFF imagery.

None of that is prohibitive. It is, however, a permanent licence obligation attached to a file that
`@workouts/core` will be shipping to every consumer forever, in exchange for rows that — as §5 argues —
are the wrong rows anyway.

### Where this is genuinely unclear, stated plainly

- **How many rows make a "Substantial part"** of a 4.7-million-product database has no bright line, and
  the licence deliberately refuses to draw one. A confident "300 rows is de minimis" is not a reading the
  text supports; §4.4(b) plus the Substantial definition point the other way. **I would not rely on
  de-minimis without a lawyer**, and I would not expect a lawyer to give a clean yes.
- **The DbCL argument** — that *individual* contents are under DbCL 1.0, which imposes essentially no
  conditions, so cherry-picking individual facts escapes ODbL — is the strongest counter-argument
  available, and it is not obviously wrong. §4.4(b) is written precisely to close it for the case where
  the picked facts are reassembled into a new database, which is exactly what a code constant is. I judge
  the counter-argument to lose, but I am not certain, and **this is the one point where a real opinion
  would be worth buying if the OFF-derived list were otherwise attractive.** It isn't (§5), so it is
  cheaper to sidestep than to litigate.
- **Whether nutrition facts are protectable at all** (facts are not copyrightable in the US; the EU
  *sui generis* database right that ODbL leans on is a different animal, and OFF is a French association)
  is a real question that is emphatically outside what a research ticket can settle.

The honest bottom line: **Case A is safe with a visible attribution line. Case B is legally workable but
carries a permanent, non-trivial obligation and one genuinely uncertain question — which is a bad trade
when a public-domain source exists.**

---

## 4. Data quality, and how gather's mapping copes

### Coverage, measured live

| Query | Count |
| --- | --- |
| Products in the database (homepage) | **4,724,568** |
| `states_tags=en:nutrition-facts-completed` | **3,578,333** (~76%) |
| `countries_tags=en:netherlands` | **108,233** |
| …of which `en:nutrition-facts-to-be-completed` | **46,756** (~43% of Dutch products lack nutrition facts) |

So roughly a quarter of the whole database, and over 40% of Dutch products, has no usable nutrition
data. Regional skew is real: OFF is strongest in France and Western Europe, and a Dutch-supermarket
product is likelier to be present than a US store brand, but "present" and "has numbers" are different
questions.

Beyond emptiness, the failure modes gather documented in code and that the probes confirm:

- **Duplicate barcodes for the same real product**, several of them near-empty — gather's comment:
  "a search for 'nutella' can return a dozen 'Nutella' hits, several with no nutrition data at all".
  Its `mapOffSearchResults` over-fetches (`page_size=40` for ~20 shown), drops nameless / barcode-less /
  nutrition-less hits, then dedupes on normalised name+brand keeping whichever duplicate has the most
  nutrients populated. That is the right shape and should be copied.
- **Free-text everything.** Names, brands, serving strings and image URLs are typed by contributors.
  Gather validates image URLs with `/^https?:\/\//` because "the import must not fail over a field
  somebody typed by hand into a community database".
- **No name at all** in the requested language, or none at all. Gather prefers `product_name_nl`, falls
  back to `product_name`, then to an empty string the user fills in on the confirm screen. Workouts is
  hardcoded English (#51), so the equivalent is `product_name` with the confirm-screen fallback — but
  the mechanism (*names are per-product, not per-request-locale*) is the transferable insight.

### The per-100g / per-serving convention

The [field documentation](https://static.openfoodfacts.org/data/data-fields.txt) is unambiguous:

> "fields that end with `_100g` correspond to the amount of a nutriment (in g, or kJ for energy) for
> 100 g or 100 ml of product"
> "fields that end with `_serving` correspond to the amount of a nutriment … for 1 serving"

Four things follow, all confirmed against live products:

1. **`_100g` is always normalised, even when the contributor entered per-serving figures.** OFF does the
   division; you do not. `nutrition_data_per` records what was typed, not what `_100g` means.
2. **`energy_100g` is kilojoules.** kcal lives in `energy-kcal_100g`. Gather maps `calories` from
   `energy-kcal_100g` — correct, and the trap is right next door.
3. **Normalised values arrive unrounded.** A live lookup returned
   `"energy-kcal_100g": 565.371024734982` and `"proteins_100g": 7.06713780918728` for a bag of crisps —
   the artefact of dividing a per-serving figure. Round at display; never show a user 14 decimal places
   of protein.
4. **Most products declare no serving.** The canonical Nutella barcode returns no `serving_size`,
   `serving_quantity` or `nutrition_data_per` at all. Gather's `declaredServings` returns an empty list
   in that case, and its comment says so — "which is most of them". Where a serving *is* declared, it is
   free text ("1 serving (28 g)") with a numeric `serving_quantity` alongside; gather prefers the number
   and falls back to a leading-number regex over the string, comma-decimal included.

Gather's `NUTRIMENT_MAPPINGS` is a good starting field list for Fuel: `energy-kcal_100g`, `proteins_100g`,
`carbohydrates_100g`, `sugars_100g`, `fat_100g`, `saturated-fat_100g`, `fiber_100g`, `salt_100g`. For a
training app, protein is the field that must never be silently absent — a hit with no `proteins_100g` is
close to useless for fuelling and is a candidate for filtering out of results entirely, which is a
sharper rule than gather's "any nutrient at all".

---

## 5. Could a dataset *be* the shipped list?

Mechanically, yes. OFF publishes nightly bulk exports ([Data, API and SDKs](https://world.openfoodfacts.org/data)):
MongoDB dump, JSONL (`openfoodfacts-products.jsonl.gz`), CSV
(`en.openfoodfacts.org.products.csv.gz`, **~0.9 GB compressed / ~9 GB uncompressed**), a Parquet copy on
Hugging Face, and 14 days of daily deltas. Filtering that to a few hundred rows at build time is an
afternoon's work, and the docs actively prefer it to hammering the API.

**But it is the wrong source for this particular list, on three independent grounds:**

1. **Content mismatch.** OFF is a database of *packaged, barcoded, branded products* — a specific
   Albert Heijn yoghurt, a specific Nutella jar. A "standard food list" for a training app wants generic
   whole foods: chicken breast, rolled oats, white rice, olive oil, whole egg. OFF has such entries only
   incidentally, they are unevenly named, and picking the "right" chicken breast out of thousands of
   branded packets is a curation problem the dataset does not help with. The shipped list and OFF are
   answering different questions — which is exactly why #51 has both.
2. **Quality mismatch.** A shipped constant is read-only with fork-on-edit (#51), so a wrong figure is
   permanent for everyone until a release. Community-entered figures, ~24% of which are missing outright
   and some of which arrive as `565.371024734982`, are the wrong provenance for data with that property.
   Whatever ships needs to be figures somebody *checked*, and at a few hundred rows checking is feasible.
3. **Licensing.** §3 Case B: an ODbL-licensed artefact inside `@workouts/core` forever, a §4.6 obligation
   to publish a machine-readable copy, and one genuinely unsettled question about Substantiality. All of
   it avoidable.

**And there is a clean alternative that removes ground 3 entirely and helps with 1 and 2.**
[USDA FoodData Central](https://fdc.nal.usda.gov/api-guide/): its data "are in the public domain and
they are not copyrighted", published under **CC0 1.0 Universal**, with a *request* (not a condition) to
cite it. Its SR Legacy and Foundation Foods datasets are generic whole foods — precisely the list's
subject matter — laboratory-analysed rather than crowd-typed, and downloadable in bulk. CC0 means the
rows can be embedded in a code constant with no share-alike, no §4.6 copy obligation, and no licence
inherited by `@workouts/core`'s consumers. (Its *API* needs a data.gov key at 1,000 req/hour/IP and keys
"found publicly will be deactivated" — irrelevant here, because the list is built once at authoring time,
not fetched at runtime. That same clause is a reason **not** to use FDC as the runtime scan source from a
phone.)

The honest caveat: FDC is US-centric in naming and portion conventions, and it is not a substitute for OFF
at runtime — it has no barcodes worth speaking of. It is a source for *authoring* a curated list, most
likely by hand, with FDC as the figure of record and a citation line in the file.

---

## 6. Offline

There is no practical on-device OFF dataset. The smallest full export is ~0.9 GB compressed; there is no
published subset, and OFF's own answer to heavy use is "host a local instance of Product Opener", which is
a server, not a phone. **Import is online-only.**

That is less limiting than it sounds, because #51's architecture already absorbs it:

- The **shipped standard list is a code constant** — always available, no network.
- **Personal foods are device-local** — always available.
- **Diary entries snapshot their nutrition figures** rather than reading them live — so everything already
  logged renders offline.

Only the *act of importing something new from OFF* requires connectivity. The rule that follows: OFF
search and scan degrade to a clear "can't reach Open Food Facts — add it by hand" that lands the user in
manual entry, never a blocking error. Gather's never-throw contract in `offFetch.ts` (null on malformed
barcode, network error, timeout, non-OK status, invalid JSON, with the caller falling back to manual entry)
is the pattern to copy verbatim.

A short client-side cache of recent lookups is worth having for the scan-the-same-yoghurt-every-morning
case, but it is a convenience, not offline support, and §3's caching caveat applies: keep it a request
cache with a TTL, not a mirror.

---

## 7. Recommendations

### Where the OFF call is made from: **the phone, directly.**

1. OFF documents this as the intended arrangement for mobile apps, and it is the *only* arrangement where
   the rate limit scales with users: "If your requests come from your users directly (ex: mobile app), the
   rate limits apply per user."
2. A Convex action pools every user's traffic onto infrastructure IPs we do not control, where the
   documented penalty for exceeding 15/min is a ban. That is a single point of failure for the whole app,
   created voluntarily, in exchange for nothing.
3. Nothing forces a server into the path. There is no API key to hide (reads need only a `User-Agent`),
   CORS is open, and `User-Agent` is not a forbidden header.
4. It keeps OFF traffic off the Convex function budget, which matters for a scan-heavy diary.
5. Personal foods are already device-local (#51) — a direct call keeps the whole import path on the device
   and does not make Convex the dependency for a feature whose output may never reach it.

Conditions on that recommendation:

- Send `workouts/<version> (<contact email>)` as the `User-Agent`, and **verify on device** that React
  Native forwards it unmodified before shipping.
- Debounce the search box hard and only call on a settled term — 10 search req/min is not many, CGNAT
  users may be sharing that bucket, and the search host is slow (~8s observed on aggregate queries).
- Treat 429 and 503 as first-class states with a retry-after-a-moment message, not as generic failures.
- Keep the never-throw contract: any failure falls through to manual entry.
- Revisit only if OFF starts blocking mobile ranges or the app grows a web surface with different
  constraints. A Convex action stays the escape hatch — it is a small, contained change to move the call —
  but it should not be built pre-emptively.

### Whether the shipped standard-food list can be OFF-derived: **no — hand-author it, with USDA FoodData Central as the source of record.**

Not primarily because the licence forbids it — it doesn't, quite — but because the licence makes it
expensive and uncertain (an ODbL artefact permanently inside `@workouts/core`, a §4.6 obligation to publish
a machine-readable copy, and a Substantiality question I cannot resolve without a lawyer and would not
expect a clean answer to), while the data itself is the wrong data: branded packets where the list wants
generic whole foods, and crowd-entered figures where a read-only, fork-on-edit constant needs checked ones.

Concretely, for #55:

- Author a few hundred generic foods by hand, taking figures from USDA FoodData Central (CC0, public
  domain, laboratory-analysed), with a citation line in the file. No licence obligation flows to
  `@workouts/core` or its consumers.
- Ship **no OFF-derived rows and no OFF imagery** in the constant.
- Keep OFF strictly as the *runtime* import path for branded, barcoded products, where §4.5(b) applies and
  the only obligation is a visible attribution notice.
- Put that notice in from the first screen: **"Contains information from
  [Open Food Facts](https://openfoodfacts.org), made available under the
  [Open Database License](https://opendatacommons.org/licenses/odbl/1-0/)"**, shown wherever OFF-sourced
  figures are displayed.

---

## Sources

- Open Food Facts, [Introduction to the API](https://openfoodfacts.github.io/openfoodfacts-server/api/) — versions, rate limits, User-Agent policy, bulk-download guidance, the per-user mobile statement.
- Open Food Facts, [Terms of use, contribution and re-use](https://world.openfoodfacts.org/terms-of-use) — ODbL / DbCL / CC-BY-SA split and the attribution requirement.
- Open Food Facts, [Data, API and SDKs](https://world.openfoodfacts.org/data) — bulk exports, formats, sizes, update frequency.
- Open Food Facts, [data-fields.txt](https://static.openfoodfacts.org/data/data-fields.txt) — the `_100g` / `_serving` conventions.
- Open Knowledge Foundation, [ODbL 1.0 full text](https://opendatacommons.org/licenses/odbl/1-0/) — definitions and §4.2–4.7, quoted above.
- USDA, [FoodData Central API guide](https://fdc.nal.usda.gov/api-guide/) — CC0 / public-domain status, citation request, 1,000 req/hour/IP, key-privacy clause.
- WHATWG, [Fetch Standard](https://fetch.spec.whatwg.org/) — the forbidden request-header list (which does not include `User-Agent`).
- Live API probes against `world.openfoodfacts.org` (v2 and v3 product endpoints, v2 search counts) and `search.openfoodfacts.org`, 2026-09-02.
- `AppElent/gather`: `convex/lib/offFetch.ts`, `convex/lib/offMapping.ts` and their tests — the working reference implementation and the edge cases it records.
