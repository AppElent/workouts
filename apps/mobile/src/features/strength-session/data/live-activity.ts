/**
 * The strength session's Live Activity. Live Activities exist only on iOS
 * (`live-activity.ios.ts`); everywhere else these do nothing.
 */
import type { LiveActivityProps } from "./live-activity-props";

/** Starts or updates the one session activity, replacing any another session left. */
export function showSessionActivity(_props: LiveActivityProps): void {}
/** Ends every session activity. */
export function endSessionActivity(): void {}
/** Ends every session activity again when the last end failed. */
export function retryFailedEnd(): void {}
