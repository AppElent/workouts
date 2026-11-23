/**
 * The between-sets rest timer. The countdown is derived from a persisted end
 * time, not decremented on a tick, so a lock or a restart leaves it correct.
 * A foreground end gives a haptic and a lime pill; a background end is a local
 * notification, which every adjustment reschedules or cancels.
 *
 * A rest belongs to the session it began in. Anything that reads the timer
 * sees it idle unless that session is the active one, and a rest left behind
 * by a session that ended elsewhere is cleared, with its notification.
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
/** How long "Rest over" stays up before it clears itself (APP-624). */
export const REST_OVER_LINGER_MS = 30_000;

type Stored = {
	endsAt: number | null;
	body: string | null;
	/** The session the rest began in; null on an entry written before rests had one. */
	sessionId: string | null;
};
const IDLE: Stored = { endsAt: null, body: null, sessionId: null };
function parseStored(value: unknown): Stored {
	const stored = value as Partial<Stored> | null;
	return {
		endsAt: typeof stored?.endsAt === "number" ? stored.endsAt : null,
		body: typeof stored?.body === "string" ? stored.body : null,
		sessionId: typeof stored?.sessionId === "string" ? stored.sessionId : null,
	};
}
/**
 * What the active session may see of a stored rest. `undefined` means the
 * active session is still loading: nothing shows until it is known.
 */
function visibleTo(stored: Stored, activeSessionId: string | null | undefined) {
	return stored.sessionId !== null && stored.sessionId === activeSessionId
		? stored
		: IDLE;
}
function load(subject: string | null): Stored {
	if (!subject) return IDLE;
	const read = readLocalJson(restKeys.key(subject), parseStored);
	return read.ok ? (read.value ?? IDLE) : IDLE;
}

export type RestTimerApi = {
	/** Starts or restarts a countdown for the session it runs in. */
	start: (sessionId: string, seconds: number, body?: string) => void;
	stop: () => void;
	adjust: (delta: number) => void;
	/** Puts back a previous end time, for undoing a log. */
	restore: (endsAt: number | null) => void;
	current: () => number | null;
};
type RestState = {
	running: boolean;
	/** Epoch ms the countdown ends at; null when no rest runs. */
	endsAt: number | null;
	remaining: number;
	over: boolean;
};
const RestApiContext = createContext<RestTimerApi | null>(null);
const RestStateContext = createContext<RestState>({
	running: false,
	endsAt: null,
	remaining: 0,
	over: false,
});

/**
 * One countdown per account; `subject` is null while signed out.
 * `activeSessionId` is the account's running session: null when there is none,
 * undefined while that is still loading.
 */
export function RestTimerProvider({
	subject,
	activeSessionId,
	children,
}: {
	subject: string | null;
	activeSessionId: string | null | undefined;
	children: ReactNode;
}) {
	const copy = useI18n().t.strength.plan.rest;
	const [raw, setStored] = useState(() => load(subject));
	const [now, setNow] = useState(() => Date.now());
	const stored = useMemo(
		() => visibleTo(raw, activeSessionId),
		[raw, activeSessionId],
	);
	const current = useRef(raw);
	current.current = raw;
	const visible = useRef(stored);
	visible.current = stored;
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
			visible.current = next;
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
			start(sessionId, seconds, body) {
				const endsAt = Date.now() + seconds * 1000;
				write({ endsAt, body: body ?? null, sessionId });
				schedule(endsAt, body ?? null);
			},
			stop() {
				write(IDLE);
				void cancelSessionAlert(ALERT_ID);
			},
			adjust(delta) {
				const { endsAt, body, sessionId } = visible.current;
				if (endsAt === null) return;
				const nowMs = Date.now();
				// Once rest is over −15 has nothing to take away; +15 starts it again.
				if (endsAt <= nowMs && delta < 0) return;
				const next = Math.max(nowMs, endsAt) + delta * 1000;
				write({ endsAt: Math.max(nowMs, next), body, sessionId });
				schedule(Math.max(nowMs, next), body);
			},
			restore(endsAt) {
				const { body, sessionId } = visible.current;
				if (endsAt !== null && sessionId === null) return;
				write({ endsAt, body, sessionId });
				if (endsAt === null) void cancelSessionAlert(ALERT_ID);
				else schedule(endsAt, body);
			},
			current: () => visible.current.endsAt,
		};
	}, [copy, subject]);
	// "Rest over" is a nudge, not a state: it clears itself after a while, so
	// the Now card and the dock go back to the next set without a log.
	const endsAt = stored.endsAt;
	useEffect(() => {
		if (endsAt === null) return;
		const timer = setTimeout(
			() => {
				// A +15 in the meantime moved the end, so this one is stale.
				if (visible.current.endsAt === endsAt) api.stop();
			},
			Math.max(0, endsAt + REST_OVER_LINGER_MS - Date.now()),
		);
		return () => clearTimeout(timer);
	}, [endsAt, api]);
	// A rest left by another session is cleared once the active one is known.
	// An entry from before rests carried a session id is taken over by the
	// active session while it still runs, so shipping this mid-rest keeps it.
	useEffect(() => {
		if (activeSessionId === undefined || raw.endsAt === null) return;
		if (raw.sessionId === activeSessionId) return;
		if (
			raw.sessionId === null &&
			activeSessionId !== null &&
			raw.endsAt > Date.now()
		) {
			const adopted = { ...raw, sessionId: activeSessionId };
			if (subject) writeLocalJson(restKeys.key(subject), adopted);
			setStored(adopted);
			return;
		}
		if (subject) writeLocalJson(restKeys.key(subject), IDLE);
		setStored(IDLE);
		void cancelSessionAlert(ALERT_ID);
	}, [raw, activeSessionId, subject]);
	const state = useMemo(
		() => ({ running, endsAt: stored.endsAt, remaining, over }),
		[running, stored.endsAt, remaining, over],
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
