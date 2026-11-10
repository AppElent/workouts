/**
 * The phone's haptic vocabulary.
 *
 * **Call sites name events, never intensities.** `haptics.entryLogged()`, not
 * `notificationAsync(Success)` — so "how hard should a logged meal feel" is
 * answered once, here. It is also the only place Android's vocabulary diverges
 * from iOS's, and the only place a future "reduce haptics" preference would go.
 *
 * **Restraint is the point.** Haptics are limited to *meaningful selection*,
 * *successful logging*, and *destructive warning* — not routine taps. There is
 * deliberately no `buttonPressed()` here, because adding one is how an app ends
 * up buzzing on every tap.
 *
 * **Nothing here is ever the only signal.** iOS silently plays nothing in Low
 * Power Mode, when the user has turned haptics off, while the camera is open,
 * and during dictation — so every call site also draws or says the same thing.
 *
 * Every call is fire-and-forget and swallows its rejection: a failed haptic must
 * never take a save down with it.
 */
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

/**
 * Read at call time via `Platform.OS`, not `process.env.EXPO_OS`:
 * `babel-preset-expo` inlines the latter at build time, so tests could not
 * exercise both platforms.
 */
function isAndroid(): boolean {
	return Platform.OS === "android";
}

function play(run: () => Promise<void>): void {
	try {
		run().catch(() => undefined);
	} catch {
		// A synchronous throw from a missing native module is equally ignorable.
	}
}

export const haptics = {
	setLogged(): void {
		play(() =>
			isAndroid()
				? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Confirm)
				: Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
		);
	},

	/** A logged set beat what was known, or rest ended while the app is open. */
	sessionSuccess(): void {
		play(() =>
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
		);
	},

	/** A log failed, or a typo check needs an explicit second tap. */
	sessionWarning(): void {
		play(() =>
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
		);
	},

	/**
	 * A meaningful selection moved: a serving option, a meal slot, a goal
	 * direction. Not every press — only the ones that change what a subsequent
	 * confirm will write.
	 */
	selectionChanged(): void {
		play(() => Haptics.selectionAsync());
	},

	/**
	 * A diary entry was written. The one success haptic in Nutrition: the screen
	 * leaves immediately afterwards, so the buzz is the receipt for an action
	 * whose result is on the *next* screen.
	 */
	entryLogged(): void {
		play(() =>
			isAndroid()
				? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Confirm)
				: Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
		);
	},

	/**
	 * A destructive confirmation was raised. Warning, not error: nothing has gone
	 * wrong yet.
	 */
	destructiveWarning(): void {
		play(() =>
			isAndroid()
				? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Reject)
				: Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
		);
	},

	/**
	 * A swipe crossed the point where the revealed actions stay open — the cue
	 * that you have gone far enough while your thumb covers the row.
	 */
	swipeThresholdPassed(): void {
		play(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
	},

	/**
	 * A swipe went far enough that letting go runs the row's outermost action
	 * (a full swipe). Stronger than the open threshold: this one commits.
	 */
	swipeCommitArmed(): void {
		play(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
	},

	/** A press-and-hold opened an action menu. */
	menuOpened(): void {
		play(() =>
			isAndroid()
				? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Long_Press)
				: Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
		);
	},
};
