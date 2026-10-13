---
type: decision
description: Read before changing food photo ownership or retiring migrated device stores.
version: 1.0.0
status: accepted
date: 2026-10-13
---

# Store own food photos with the account and retire migrated local copies

Own Food and One-off Entry photos use Convex file storage. Account records retain
storage identifiers; reads resolve usable URLs. Open Food Facts images retain
provider URLs and use disposable device caches. Choosing a custom crop or
replacement creates an own photo. Preset icons remain portable.

This supersedes ADR 0014’s device-only photo exception. That exception prevented
photos from surviving reinstalling even when the Food itself was online. Keeping
provider images on OFF avoids duplicating third-party image storage. Missing
images fall back visually and do not change frozen nutrition snapshots.

The sole user chose current provider images for ambiguous existing OFF imports
and confirmed the build 20 data upload completed. Retire the legacy migration
and replay machinery and persistent account read copies after that cutover.
Nutrition snapshots and library revisions use account-scoped session memory.
Remembered portions, view preferences, Set Drafts and bounded OFF caches retain
their independent device purposes. Pending legacy journal work must be uploaded
with build 20 before upgrade; unuploaded manual photo originals remain available
until acknowledgement. Do not silently discard unknown original records.

Uploaded photos remain stored while historical diary snapshots may reference
them. Deleting a Food does not delete its historical photo. Explicit account
Test Data Clear/Load removes that account’s uploaded files too.

Accepted on 2026-10-13. See the
[product contract](../contracts/account-data.md) and
[cleanup verification](../records/2026-10-13-food-photos-and-cache-cleanup.md).
