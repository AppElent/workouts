# Running and cycling V1

Manual logging on iOS and Android uses the shared Convex backend. Runs and rides
are completed Activities. Strength Sessions retain their storage and are adapted
into shared history. GPS, imports, plans, offline synchronization, imperial units,
and inferred personal records are outside this release.

## Screen contracts

| Screen | Immediate job and primary action | Navigation and native pattern |
| --- | --- | --- |
| Log run / Log ride | Record date/time, distance and exercise duration; Save activity | Home, activity picker or filtered history opens a native stack screen using the shared form seam. Optional details are progressively disclosed. Save replaces creation with details; edit returns to details. Back asks before discarding changed input. |
| Activity detail | Review a saved activity; Edit | History or Save opens a stack screen. Grouped metrics and optional details use opaque surfaces. Delete uses the shared confirmation with a sport-specific label and returns to history. |
| Activity history | Find completed activities; Log run/ride for the selected sport | Home See all or Train opens a stack screen. Native segmented/menu selection filters All, Strength, Running, Cycling. Rows open sport-specific details; Load more retrieves older records. |
| Progress, Running/Cycling | Review weekly distance, duration and average pace/speed; choose week | Existing Progress tab retains Exercises and Body. Running/Cycling show the current week and eleven preceding weeks using native chart adapters. Week navigation uses local Monday boundaries. |
| Home | Review this week and continue/log training | Existing native tab retains active strength resume. Recent completed activities lead to details; See all opens history. The illustrative run recommendation is replaced by working logging actions. |

New views distinguish loading skeletons, an empty history or empty week, and
query errors with retry. Mutation errors preserve the form and surface a toast;
pending buttons prevent repeated submission. Shared form scrolling and native
headers handle keyboard/safe areas; text wraps at large type sizes. Labels and
new content are available in English and Dutch. Long titles and notes remain
readable in details rather than being silently truncated.

## Data and compatibility

- New Activity envelopes link one-to-one to endurance details. Distances are
  metres, duration is seconds excluding breaks, timestamps are epoch milliseconds.
- Manual creation uses a stable client identifier to deduplicate retries. Optional
  fields may be cleared by editing. Server functions enforce user ownership.
- Mixed history uses bounded indexed pages; date-range totals drain all pages.
  Counts never depend on the recent-list limit. Pace and speed derive from total
  distance and duration, rather than averaging individual activities' rates.
- Nutrition receives only a completed-activity boolean for a local calendar day.
  Nutrition goals, calories and expenditure remain independent.
- Deploy the additive backend before a mobile release. Existing strength clients
  continue to use their current APIs. No historical-data migration is required.

## Verification

Automated coverage includes field parsing, calculation, duplicate-save protection,
discard confirmation, clearing optional values, ownership, cursor isolation,
history pagination/reactivity, complete weekly totals, exports, and nutrition's
day marker. Device observations and remaining verification limits are recorded in
the endurance verification report under `docs/reports/`.
