# Always split the Activity envelope from type-specific detail

As the app broadens from strength-only to a generic Activity model (strength, running, cycling, WODs, and future types), we decided every Activity type stores its type-specific data in a separate detail table keyed to the Activity envelope — even for simple types like a run, where the detail is just a handful of numeric fields that would easily fit as optional columns on the envelope itself.

We chose this over a wide envelope table with optional columns per type (the pattern already visible in `wods`/`hostedWorkouts`) so that the Activity envelope's shape never depends on which type it is. That lets mobile UI, sync logic, and cross-type analytics treat any Activity generically and only branch into type-specific code when they actually need type-specific fields, instead of accumulating an ever-growing set of nullable columns as new activity types are added.

## Considered options

- **Wide envelope with optional columns per type** — rejected: produces the same optional-field sprawl already present in `hostedWorkouts`, and gets worse with every new activity type.
