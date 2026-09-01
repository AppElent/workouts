/**
 * The between-sets rest timer, ported from the web's
 * `src/components/session/RestTimer.tsx`.
 *
 * The countdown is derived from an end timestamp rather than decremented on a
 * tick. `setInterval` drifts, and it stops entirely when the phone sleeps or
 * the app backgrounds — which is most of a rest period. Storing *when* it ends
 * and re-deriving the remainder each render means backgrounding the app for two
 * minutes leaves the timer correct, not two minutes behind.
 *
 * Completion buzzes via `expo-haptics`. The web also plays a synthesised beep
 * through `AudioContext`; that is deliberately not ported — it would mean a
 * media dependency and a bundled sound file for a cue the haptic already gives,
 * in a room that is usually loud.
 *
 * The default duration persists per device via `expo-secure-store` (the phone's
 * `localStorage` equivalent). It is a preference, not data — nothing syncs.
 */
import * as Haptics from "expo-haptics";
import * as SecureStore from "expo-secure-store";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radius, spacing } from "../theme";
import { AppText } from "./text";

const STORAGE_KEY = "restTimer.defaultSeconds";
const PRESETS = [60, 90, 120, 180];
const FALLBACK_SECONDS = 90;

/** Sits above the tab bar and the active-session bar, not under them. */
const BOTTOM_ALLOWANCE = 128;

type RestTimerApi = {
	/** Starts (or restarts) a countdown. Defaults to the saved preference. */
	start: (seconds?: number) => void;
	stop: () => void;
};

const RestTimerContext = createContext<RestTimerApi | null>(null);

function format(seconds: number) {
	const safe = Math.max(0, seconds);
	const m = Math.floor(safe / 60);
	const s = safe % 60;
	return `${m}:${s.toString().padStart(2, "0")}`;
}

export function RestTimerProvider({ children }: { children: ReactNode }) {
	const insets = useSafeAreaInsets();
	const [defaultSeconds, setDefaultSeconds] = useState(FALLBACK_SECONDS);
	const [endsAt, setEndsAt] = useState<number | null>(null);
	const [paused, setPaused] = useState<number | null>(null);
	const [now, setNow] = useState(() => Date.now());
	// Guards the completion buzz so it fires once per countdown, not every tick
	// after zero.
	const firedRef = useRef(false);

	// Load the saved preference. Reading secure storage can throw on a device
	// with no keychain; the fallback is a working timer, so it is not worth
	// surfacing.
	useEffect(() => {
		let cancelled = false;
		SecureStore.getItemAsync(STORAGE_KEY)
			.then((stored) => {
				if (cancelled || !stored) return;
				const parsed = Number.parseInt(stored, 10);
				if (Number.isFinite(parsed) && parsed > 0) setDefaultSeconds(parsed);
			})
			.catch(() => {});
		return () => {
			cancelled = true;
		};
	}, []);

	useEffect(() => {
		if (endsAt === null || paused !== null) return;
		const id = setInterval(() => setNow(Date.now()), 500);
		return () => clearInterval(id);
	}, [endsAt, paused]);

	const remaining =
		paused ?? (endsAt === null ? 0 : Math.ceil((endsAt - now) / 1000));

	useEffect(() => {
		if (endsAt === null || paused !== null || firedRef.current) return;
		if (remaining > 0) return;
		firedRef.current = true;
		Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
			() => {},
		);
	}, [remaining, endsAt, paused]);

	const api = useMemo<RestTimerApi>(
		() => ({
			start: (seconds) => {
				firedRef.current = false;
				setPaused(null);
				setEndsAt(Date.now() + (seconds ?? defaultSeconds) * 1000);
				setNow(Date.now());
			},
			stop: () => {
				setEndsAt(null);
				setPaused(null);
			},
		}),
		[defaultSeconds],
	);

	const adjust = useCallback(
		(delta: number) => {
			if (paused !== null) {
				setPaused((prev) => Math.max(0, (prev ?? 0) + delta));
				return;
			}
			setEndsAt((prev) => (prev === null ? prev : prev + delta * 1000));
			firedRef.current = false;
		},
		[paused],
	);

	const togglePause = useCallback(() => {
		if (paused !== null) {
			setEndsAt(Date.now() + paused * 1000);
			setPaused(null);
			setNow(Date.now());
		} else if (endsAt !== null) {
			setPaused(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
		}
	}, [paused, endsAt]);

	const chooseDefault = useCallback((seconds: number) => {
		setDefaultSeconds(seconds);
		SecureStore.setItemAsync(STORAGE_KEY, String(seconds)).catch(() => {});
	}, []);

	const running = endsAt !== null;

	return (
		<RestTimerContext.Provider value={api}>
			{children}
			{running ? (
				<View
					style={[styles.wrap, { bottom: insets.bottom + BOTTOM_ALLOWANCE }]}
					pointerEvents="box-none"
				>
					<View style={[styles.pill, remaining <= 0 && styles.done]}>
						<Pressable
							onPress={() => adjust(-15)}
							hitSlop={8}
							accessibilityRole="button"
							accessibilityLabel="Subtract 15 seconds"
						>
							<AppText style={styles.adjust}>−15</AppText>
						</Pressable>

						<Pressable onPress={togglePause} style={styles.readout}>
							<AppText style={styles.time}>
								{remaining <= 0 ? "Rest over" : format(remaining)}
							</AppText>
							{paused !== null ? (
								<AppText style={styles.pausedLabel}>paused</AppText>
							) : null}
						</Pressable>

						<Pressable
							onPress={() => adjust(15)}
							hitSlop={8}
							accessibilityRole="button"
							accessibilityLabel="Add 15 seconds"
						>
							<AppText style={styles.adjust}>+15</AppText>
						</Pressable>

						<Pressable
							onPress={api.stop}
							hitSlop={8}
							accessibilityRole="button"
							accessibilityLabel="Dismiss rest timer"
						>
							<AppText style={styles.dismiss}>✕</AppText>
						</Pressable>
					</View>

					<View style={styles.presets}>
						{PRESETS.map((seconds) => (
							<Pressable
								key={seconds}
								onPress={() => chooseDefault(seconds)}
								style={[
									styles.preset,
									seconds === defaultSeconds && styles.presetActive,
								]}
							>
								<AppText
									style={[
										styles.presetText,
										seconds === defaultSeconds && styles.presetTextActive,
									]}
								>
									{seconds}s
								</AppText>
							</Pressable>
						))}
					</View>
				</View>
			) : null}
		</RestTimerContext.Provider>
	);
}

/**
 * Returns a no-op timer outside the provider rather than throwing. A screen
 * that logs a set should not crash because it is rendered somewhere without
 * rest-timer chrome — the timer is a convenience, not a requirement.
 */
export function useRestTimer(): RestTimerApi {
	const api = useContext(RestTimerContext);
	return api ?? NOOP_TIMER;
}

const NOOP_TIMER: RestTimerApi = { start: () => {}, stop: () => {} };

const styles = StyleSheet.create({
	wrap: {
		position: "absolute",
		left: spacing.md,
		right: spacing.md,
		gap: spacing.xs,
		zIndex: 55,
	},
	pill: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: spacing.sm,
		minHeight: 52,
		paddingHorizontal: spacing.md,
		borderRadius: radius.pill,
		backgroundColor: colors.surface2,
		borderWidth: 1,
		borderColor: colors.borderStrong,
	},
	done: { borderColor: colors.accent },
	readout: { alignItems: "center", minWidth: 88 },
	time: {
		fontSize: 18,
		fontWeight: "800",
		color: colors.text,
		fontVariant: ["tabular-nums"],
	},
	pausedLabel: { fontSize: 9, color: colors.textMuted },
	adjust: { fontSize: 13, fontWeight: "800", color: colors.textMuted },
	dismiss: { fontSize: 15, fontWeight: "800", color: colors.textMuted },
	presets: { flexDirection: "row", gap: spacing.xs, justifyContent: "center" },
	preset: {
		paddingVertical: 4,
		paddingHorizontal: 10,
		borderRadius: radius.pill,
		backgroundColor: colors.surface,
	},
	presetActive: { backgroundColor: colors.accent },
	presetText: { fontSize: 10, fontWeight: "700", color: colors.textMuted },
	presetTextActive: { color: colors.onAccent },
});
