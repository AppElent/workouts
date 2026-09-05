# Primary mobile CTA is "Start Activity" (type picker), not "Start Workout"

The issue #46 shell prototype's three navigation variants all center on a single strength-specific "Start Workout" action — variant C even makes it the app's front door. As the domain model broadens to treat strength, running, cycling, and other activity types as peers (see [ADR-0001](./0001-activity-envelope-detail-split.md)), we decided the shell's primary CTA should be "Start Activity," which then asks the user to pick a type, rather than privileging strength training as the one specific entry point.

Strength can still be the only type actually implemented at first — this only fixes the *shape* of the entry point so the UI doesn't need to be reworked when other activity types ship. Whichever shell variant is chosen from #46, its primary action should be updated to this generic form before other activity types are built.
