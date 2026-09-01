# Workouts

A fitness/health tracking app, expanding from strength training into a generic platform covering running, cycling, and other logged health activities, across web and mobile clients on a shared Convex backend.

## Language

**Activity**:
The umbrella term for a single logged instance of physical movement performed over a duration — a strength session, a run, a ride, or a WOD. Does not include nutrition or other non-movement logs.
_Avoid_: Workout (as the umbrella term — reserve for strength-specific UI/legacy code until renamed), Session

**Nutrition**:
A separate concept from Activity, parallel to `bodyMetrics`: logs of what a user eats, not something performed over a duration. Not modeled as an Activity type.
_Avoid_: Meal Activity, food log entry (as an Activity subtype)

**Goal**:
A target with its own lifecycle (set, active, achieved, abandoned), computed from an aggregate of Activity, Nutrition, or bodyMetrics records over time — not a field embedded on those individual records.
_Avoid_: Target (as a field on Activity/Nutrition/bodyMetrics rows)
