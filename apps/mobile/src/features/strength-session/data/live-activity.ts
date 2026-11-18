/**
 * The strength session's Live Activity. Live Activities exist only on iOS
 * (`live-activity.ios.ts`); everywhere else these do nothing.
 */
import type { LiveActivityProps } from "./live-activity-props";

/** Starts, adopts or updates the one session activity. */
export function showSessionActivity(_props: LiveActivityProps): void {}
/** Ends every session activity. */
export function endSessionActivity(): void {}
