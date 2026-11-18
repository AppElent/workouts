/**
 * The strength session's Live Activity. Live Activities exist only on iOS
 * (`live-activity.ios.ts`); everywhere else these do nothing.
 */
import type { LiveActivityProps } from "./live-activity-props";

/** Starts or updates the one session activity, replacing any it did not start. */
export function showSessionActivity(_props: LiveActivityProps): void {}
/** Ends every session activity. */
export function endSessionActivity(): void {}
