---
status: proposed
---

# Model Activity as a closed family with shared envelopes

Activity will be a code-defined family of types with a stable shared envelope and separate type-specific detail, rather than a user-extensible catalog or one wide record full of optional fields. Every real Activity type needs its own validation and logging behavior, so pretending that types are data-driven would not remove the code and schema work; keeping details separate lets cross-type history and analytics use the envelope without accumulating type-specific nulls.

The current Strength Session, WOD Result, and Hosted Workout records predate this model. They remain unchanged until the proposed Activity migration is designed and implemented.
