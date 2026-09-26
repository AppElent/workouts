---
status: accepted
---

# Model Activity as a closed family with shared envelopes

Activity will be a code-defined family of types with a stable shared envelope and separate type-specific detail, rather than a user-extensible catalog or one wide record full of optional fields. Every real Activity type needs its own validation and logging behavior, so pretending that types are data-driven would not remove the code and schema work; keeping details separate lets cross-type history and analytics use the envelope without accumulating type-specific nulls.

The first adoption of this model adds shared Activity envelopes and separate endurance detail for manually logged Runs and Rides. Completed Strength Sessions remain in their existing storage and are adapted into shared history results at the query boundary. WOD Results and Hosted Workouts also remain in their existing storage. Any later migration of those records requires its own design.
