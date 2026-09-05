# Keep Personal Foods and Combos on the device in v1

Personal Foods and Combos live in an `expo-sqlite` database on each device, while Nutrition diary entries and goals live in Convex. Diary entries snapshot nutrition figures and provenance when logged, so synchronized history never depends on later access to the device-local source record.

We chose this boundary because Personal Foods and Combos are authoring shortcuts, while diary entries and goals are durable user history. It avoids designing synchronization, conflict resolution, and a shared personal catalogue before the product has validated those needs. Stable UUIDs leave room for future reconciliation. Platform backup/restore is best-effort, but uninstall can remove these records and a second device does not receive them; the product must disclose both consequences.

## Considered options

- **Store everything in Convex** — rejected for v1: it expands a diary feature into personal-catalogue synchronization and makes local authoring unnecessarily network-dependent.
- **Store the diary locally too** — rejected: it would make durable history device-bound and prevent the existing shared backend from serving future clients and trends.
- **Use key-value storage** — rejected: Personal Foods and Combos need migrations, indexed lookup, references, and bounded cache cleanup; a relational local table is the simpler durable model.
