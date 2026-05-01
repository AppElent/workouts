1. Fix npm run check.
   npm run check currently fails because Biome scans nested .claude/worktrees/\*/biome.json configs. Add an exclude like .claude/\*\* in biome.json (line 5), or enable gitignore usage and ignore those worktrees.

2. Make 1RM history real history
   convex/sets.ts (line 63) and convex/workoutSessions.ts (line 108) delete prior calculated 1RMs and keep only a current best. But the UI charts “1RM over time”, so you likely want immutable PR records or all calculated points. Also, a single manual 1RM currently blocks future calculated updates entirely.

3. Revisit active-session redirect behavior
   src/routes/\_\_root.tsx (line 63) redirects to the active workout whenever activeSession exists. That can trap users away from dashboard, routines, progress, profile, etc. A less surprising pattern is showing a persistent “resume workout” banner/button and only redirecting from /log.

4. Add focused tests
   There are currently no _test_ or _spec_ files. Highest-value tests would be 1RM calculation, routine start behavior, set deletion recalculating best 1RM, and weekly volume grouping.

5. Extend user profile
   Extend user profile with preferences for date-format and weight format (kg etc).

6. Cancelled workouts should be deleted right away.

7. Fix 1rm trend.
   When looking at exercise details, I see 4 sets in history, across (i think) 2 workouts, but the 1rm process says "Log at least 2 sessions to see the 1rm trend"

8. Add instructions (and simple pictures if possible) to exercise detail screen

9. Routines should be edittable
