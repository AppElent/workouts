/**
 * Local notifications for rest and group clocks. They fire when the app is in
 * the background or the phone is locked; in the foreground the pill and a
 * haptic carry the same news, so the banner stays off.
 */
import * as Notifications from "expo-notifications";
import { reportError } from "../../../observability/errors";
import type { SessionPlan, SetGroup } from "../session-plan";

let asked = false;
let allowed: boolean | null = null;
let configured = false;
function configure() {
	if (configured) return;
	configured = true;
	Notifications.setNotificationHandler({
		handleNotification: async () => ({
			shouldShowBanner: false,
			shouldShowList: false,
			shouldPlaySound: false,
			shouldSetBadge: false,
		}),
	});
}
/** Asked at the first rest. If declined, rest is only the pill and a haptic. */
async function ensurePermission() {
	if (allowed !== null) return allowed;
	const current = await Notifications.getPermissionsAsync();
	if (current.granted) {
		allowed = true;
		return true;
	}
	if (asked || !current.canAskAgain) return false;
	asked = true;
	const requested = await Notifications.requestPermissionsAsync();
	allowed = requested.granted;
	return allowed;
}
export async function scheduleSessionAlert(
	identifier: string,
	seconds: number,
	title: string,
	body: string,
) {
	try {
		configure();
		await Notifications.cancelScheduledNotificationAsync(identifier);
		if (seconds < 1 || !(await ensurePermission())) return;
		await Notifications.scheduleNotificationAsync({
			identifier,
			content: { title, body, sound: true },
			trigger: {
				type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
				seconds: Math.ceil(seconds),
			},
		});
	} catch (error) {
		// The pill and haptic still carry the news without a notification.
		reportError(error, "session-alert.schedule");
	}
}
export async function cancelSessionAlert(identifier: string) {
	try {
		await Notifications.cancelScheduledNotificationAsync(identifier);
	} catch (error) {
		reportError(error, "session-alert.cancel");
	}
}

const clockAlertId = (groupId: string) => `amrap:${groupId}`;
export function scheduleClockAlert(
	group: Pick<SetGroup, "id" | "endsAt">,
	title: string,
	body: string,
) {
	if (group.endsAt)
		void scheduleSessionAlert(
			clockAlertId(group.id),
			(group.endsAt - Date.now()) / 1000,
			title,
			body,
		);
}
export function cancelClockAlert(groupId: string) {
	void cancelSessionAlert(clockAlertId(groupId));
}
/** Ending a session takes every clock's alert with it. */
export function cancelClockAlerts(plan: SessionPlan) {
	for (const id of Object.keys(plan.groups)) cancelClockAlert(id);
}
