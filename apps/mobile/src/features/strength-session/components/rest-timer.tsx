/**
 * The between-sets rest timer. The countdown is derived from a persisted end
 * time, not decremented on a tick, so a lock or a restart leaves it correct.
 * A foreground end gives a haptic and a lime pill; a background end is a local
 * notification, which every adjustment reschedules or cancels.
 */
import Storage from "expo-sqlite/kv-store";
import {
	createContext,
	type ReactNode,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { AccessibilityInfo } from "react-native";
import { haptics } from "../../../feedback/haptics";
import { fmt, useI18n } from "../../../i18n";
import {
	cancelSessionAlert,
	scheduleSessionAlert,
} from "../data/session-notifications";

const STORAGE_KEY = "strength-rest:v1";
const FALLBACK_SECONDS = 90;
const ALERT_ID = "strength-rest";

type Stored = {
	endsAt: number | null;
	body: string | null;
	defaultSeconds: number;
};
function load(): Stored {
	try {
		const raw = Storage.getItemSync(STORAGE_KEY);
		const parsed = raw ? (JSON.parse(raw) as Partial<Stored>) : {};
		return {
			endsAt: typeof parsed.endsAt === "number" ? parsed.endsAt : null,
			body: typeof parsed.body === "string" ? parsed.body : null,
			defaultSeconds:
				typeof parsed.defaultSeconds === "number" && parsed.defaultSeconds > 0
					? parsed.defaultSeconds
					: FALLBACK_SECONDS,
		};
	} catch {
		return { endsAt: null, body: null, defaultSeconds: FALLBACK_SECONDS };
	}
}
function save(value: Stored) {
	try {
		Storage.setItemSync(STORAGE_KEY, JSON.stringify(value));
	} catch {
		// Rest still runs for as long as the app stays open.
	}
}

export type RestTimerApi = {
	/** Starts or restarts a countdown. Defaults to the saved preference. */
	start: (seconds?: number, body?: string) => void;
	stop: () => void;
	adjust: (delta: number) => void;
	/** Puts back a previous end time, for undoing a log. */
	restore: (endsAt: number | null) => void;
	current: () => number | null;
	defaultSeconds: number;
	setDefault: (seconds: number) => void;
};
export type RestState = {
	running: boolean;
	remaining: number;
	over: boolean;
};
const RestApiContext = createContext<RestTimerApi | null>(null);
const RestStateContext = createContext<RestState>({
	running: false,
	remaining: 0,
	over: false,
});

export function RestTimerProvider({ children }: { children: ReactNode }) {
	const copy = useI18n().t.strength.plan.rest;
	const [stored, setStored] = useState(load);
	const [now, setNow] = useState(() => Date.now());
	const current = useRef(stored);
	current.current = stored;
	const previousRemaining = useRef<number | null>(null);
	const running = stored.endsAt !== null;
	useEffect(() => {
		if (!running) return;
		setNow(Date.now());
		const timer = setInterval(() => setNow(Date.now()), 500);
		return () => clearInterval(timer);
	}, [running]);
	const remaining =
		stored.endsAt === null
			? 0
			: Math.max(0, Math.ceil((stored.endsAt - now) / 1000));
	const over = running && remaining <= 0;
	useEffect(() => {
		const before = previousRemaining.current;
		previousRemaining.current = running ? remaining : null;
		if (before === null || !running || before === remaining) return;
		if (remaining === 0) {
			haptics.sessionSuccess();
			AccessibilityInfo.announceForAccessibility(copy.spokenOver);
		} else if (remaining === 30 || remaining === 10) {
			AccessibilityInfo.announceForAccessibility(
				fmt(copy.spokenLeft, { seconds: remaining }),
			);
		}
	}, [remaining, running, copy]);
	const api = useMemo<RestTimerApi>(() => {
		const write = (next: Stored) => {
			current.current = next;
			save(next);
			setStored(next);
			setNow(Date.now());
		};
		const schedule = (endsAt: number, body: string | null) =>
			void scheduleSessionAlert(
				ALERT_ID,
				(endsAt - Date.now()) / 1000,
				copy.notificationTitle,
				body ?? copy.notificationPlain,
			);
		return {
			start(seconds, body) {
				const endsAt =
					Date.now() + (seconds ?? current.current.defaultSeconds) * 1000;
				write({ ...current.current, endsAt, body: body ?? null });
				schedule(endsAt, body ?? null);
			},
			stop() {
				write({ ...current.current, endsAt: null, body: null });
				void cancelSessionAlert(ALERT_ID);
			},
			adjust(delta) {
				const { endsAt, body } = current.current;
				if (endsAt === null) return;
				const nowMs = Date.now();
				// Once rest is over −15 has nothing to take away; +15 starts it again.
				if (endsAt <= nowMs && delta < 0) return;
				const next = Math.max(nowMs, endsAt) + delta * 1000;
				write({ ...current.current, endsAt: Math.max(nowMs, next), body });
				schedule(Math.max(nowMs, next), body);
			},
			restore(endsAt) {
				write({ ...current.current, endsAt });
				if (endsAt === null) void cancelSessionAlert(ALERT_ID);
				else schedule(endsAt, current.current.body);
			},
			current: () => current.current.endsAt,
			get defaultSeconds() {
				return current.current.defaultSeconds;
			},
			setDefault(seconds) {
				write({ ...current.current, defaultSeconds: seconds });
			},
		};
	}, [copy]);
	const state = useMemo(
		() => ({ running, remaining, over }),
		[running, remaining, over],
	);
	return (
		<RestApiContext.Provider value={api}>
			<RestStateContext.Provider value={state}>
				{children}
			</RestStateContext.Provider>
		</RestApiContext.Provider>
	);
}

/** A no-op outside the provider: logging a set must not depend on rest chrome. */
export function useRestTimer(): RestTimerApi {
	return useContext(RestApiContext) ?? NOOP_TIMER;
}
export function useRestState() {
	return useContext(RestStateContext);
}
const NOOP_TIMER: RestTimerApi = {
	start: () => undefined,
	stop: () => undefined,
	adjust: () => undefined,
	restore: () => undefined,
	current: () => null,
	defaultSeconds: FALLBACK_SECONDS,
	setDefault: () => undefined,
};
