/**
 * Local notifications for rest and group clocks. They fire when the app is in
 * the background or the phone is locked; in the foreground the pill and a
 * haptic carry the same news, so the banner stays off.
 */
import * as Notifications from "expo-notifications";

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
	} catch {
		// A rest pill still runs without a notification.
	}
}
export async function cancelSessionAlert(identifier: string) {
	try {
		await Notifications.cancelScheduledNotificationAsync(identifier);
	} catch {
		// Nothing was scheduled, or the module is unavailable.
	}
}
