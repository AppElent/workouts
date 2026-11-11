/**
 * The between-sets rest timer. The countdown is derived from a persisted end
 * time, not decremented on a tick, so a lock or a restart leaves it correct.
 * A foreground end gives a haptic and a lime pill; a background end is a local
 * notification, which every adjustment reschedules or cancels.
 */
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
	accountKeyspace,
	readLocalJson,
	writeLocalJson,
} from "../../../local-store/local-store";
import {
	cancelSessionAlert,
	scheduleSessionAlert,
} from "./session-notifications";

const restKeys = accountKeyspace("strength-rest:v1");
const ALERT_ID = "strength-rest";

type Stored = { endsAt: number | null; body: string | null };
const IDLE: Stored = { endsAt: null, body: null };
function parseStored(value: unknown): Stored {
	const stored = value as Partial<Stored> | null;
	return {
		endsAt: typeof stored?.endsAt === "number" ? stored.endsAt : null,
		body: typeof stored?.body === "string" ? stored.body : null,
	};
}
function load(subject: string | null): Stored {
	if (!subject) return IDLE;
	const read = readLocalJson(restKeys.key(subject), parseStored);
	return read.ok ? (read.value ?? IDLE) : IDLE;
}

export type RestTimerApi = {
	/** Starts or restarts a countdown. */
	start: (seconds: number, body?: string) => void;
	stop: () => void;
	adjust: (delta: number) => void;
	/** Puts back a previous end time, for undoing a log. */
	restore: (endsAt: number | null) => void;
	current: () => number | null;
};
type RestState = {
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

/** One countdown per account; `subject` is null while signed out. */
export function RestTimerProvider({
	subject,
	children,
}: {
	subject: string | null;
	children: ReactNode;
}) {
	const copy = useI18n().t.strength.plan.rest;
	const [stored, setStored] = useState(() => load(subject));
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
			// Rest still runs from memory when the store fails.
			if (subject) writeLocalJson(restKeys.key(subject), next);
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
				const endsAt = Date.now() + seconds * 1000;
				write({ endsAt, body: body ?? null });
				schedule(endsAt, body ?? null);
			},
			stop() {
				write(IDLE);
				void cancelSessionAlert(ALERT_ID);
			},
			adjust(delta) {
				const { endsAt, body } = current.current;
				if (endsAt === null) return;
				const nowMs = Date.now();
				// Once rest is over −15 has nothing to take away; +15 starts it again.
				if (endsAt <= nowMs && delta < 0) return;
				const next = Math.max(nowMs, endsAt) + delta * 1000;
				write({ endsAt: Math.max(nowMs, next), body });
				schedule(Math.max(nowMs, next), body);
			},
			restore(endsAt) {
				write({ ...current.current, endsAt });
				if (endsAt === null) void cancelSessionAlert(ALERT_ID);
				else schedule(endsAt, current.current.body);
			},
			current: () => current.current.endsAt,
		};
	}, [copy, subject]);
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
};
