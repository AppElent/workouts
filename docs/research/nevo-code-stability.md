# Are NEVO codes ever reused across dataset versions?

## Conclusion

**A NEVO code is not a globally permanent, never-reused identifier.** Official RIVM material
shows at least one code that was removed from NEVO-online and later added again: code `1484`
was listed as removed between the 2016 and 2019 editions, then listed among the new codes in
2025. The food description remained recognizably the same kind of product, so the evidence
proves **retirement and reactivation**, not reassignment to an unrelated food.

For the narrower 2023/8.0 → 2025/9.0 transition, RIVM's official delta lists contain 30 added
codes and 25 removed codes, with no overlap. There is therefore no evidence of a code removed
from the 2023 edition being reassigned within the 2025 edition. That one transition does not
establish a permanent no-reuse rule.

Practical implication: treat `(NEVO edition, NEVO-code)` as the durable source identity. Do
not make `NEVO-code` alone a cross-version immutable primary key, and do not infer that a low
number in an added-food list is a newly minted number.

## Evidence

### RIVM does not promise permanent code stability

RIVM describes release maintenance as adding new NEVO codes and deleting outdated codes. It
also warns users of former editions that nutrient values can change, newer analyses can
replace older values even when the product itself did not change, and previous datasets must
be requested from the NEVO team because not every edition remains available. The page makes
no statement that a deleted number is permanently reserved.

Source: [RIVM, NEVO publications](https://www.rivm.nl/en/dutch-food-composition-database/nevo-publications).

RIVM also explains that NEVO is deliberately generic: products that do not differ materially
in type and composition can be grouped under one code. This makes a code a versioned food
concept rather than a promise of immutable row contents.

Source: [RIVM, points to consider when using NEVO-online](https://www.rivm.nl/nederlands-voedingsstoffenbestand/gebruik-nevo-online/aandachtspunten).

### 2023/8.0 → 2025/9.0 has clean, disjoint add/remove lists

RIVM says that 30 foods were added and 25 removed since NEVO-online 2023. Its two official
delta documents enumerate the codes. Comparing those lists gives an empty intersection: none
of the 25 codes removed from 2023 is one of the 30 codes added in 2025.

Sources:

- [RIVM, new codes in NEVO-online 2025 since 2023 (PDF)](https://www.rivm.nl/sites/default/files/2025-11/Nieuwe-codes-Nevo-online-2025-sinds-2023.pdf)
- [RIVM, codes removed from NEVO-online 2025 since 2023 (PDF)](https://www.rivm.nl/sites/default/files/2025-11/Verwijderde-codes-NEVO-2025-sinds-2023.pdf)
- [RIVM, NEVO-online 2025 background information (PDF), §1](https://www.rivm.nl/sites/default/files/2025-11/NEVO-online-background-information-2025.pdf)

The repository's unmodified 2025/9.0 food CSV corroborates the added list: it has 2,328 rows,
contains all 30 listed additions, and contains none of the 25 listed removals. This local check
is useful verification, but the official RIVM delta documents are the primary evidence.

### A retired code was later reactivated

RIVM's official list of foods removed since NEVO-online 2016 includes:

- `1484` — *Uitjes gefrituurd zak* / *Onions deep-fried sachet*.

Source: [RIVM, foods removed since NEVO-online 2016 (PDF)](https://www.rivm.nl/sites/default/files/2019-11/Foods%20deleted%20since%20NEVO-online%202016.pdf).

RIVM's official 2025 additions list includes the same number again:

- `1484` — *Uitjes gebakken kant-en-klaar* / *Onions crisp fried ready-to-eat*.

Source: [RIVM, new codes in NEVO-online 2025 since 2023 (PDF)](https://www.rivm.nl/sites/default/files/2025-11/Nieuwe-codes-Nevo-online-2025-sinds-2023.pdf).

The local official 2025/9.0 CSV contains code `1484` with that 2025 Dutch name. Thus the code
was present by 2016, absent after removal in the 2019 change, absent from 2023 (because RIVM
calls it new since 2023), and present again in 2025.

This is code reuse in the operational sense relevant to importing successive releases: a
previously retired identifier can return. The two names both describe packaged fried onions,
so this example does **not** prove that RIVM recycles a retired number for an unrelated food.
It is best characterized as reactivation of the same or a refined food concept.

## Limits of the finding

- The full 2023/8.0 dataset was not available in this repository. RIVM's publication page says
  old datasets are available on request and may differ in format. The official 2023→2025 delta
  lists are sufficient to establish membership changes for that transition, but not to compare
  every persistent row field-by-field.
- RIVM documents that names and nutrient values can change between editions. Name inequality
  alone therefore cannot establish reassignment to a different identity.
- No official identifier policy or guarantee against reuse was found. Absence of another
  example must not be interpreted as a guarantee.

## Recommended import invariant

Store the source edition explicitly (for example, `2025/9.0`) alongside every NEVO code. During
an upgrade, diff code membership and identity fields, flag returning codes for review, and
preserve historical records against the edition they were imported from. A separate internal
stable identifier can link versions after an explicit equivalence decision.
