import { Pause, Play, RotateCcw, Timer, X } from "lucide-react";
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

const STORAGE_KEY = "restTimer.defaultSeconds";
const DEFAULT_SECONDS = 90;
const PRESETS = [60, 90, 120, 180] as const;

function loadDefault(): number {
	if (typeof window === "undefined") return DEFAULT_SECONDS;
	const raw = window.localStorage.getItem(STORAGE_KEY);
	const parsed = raw ? Number.parseInt(raw, 10) : NaN;
	return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_SECONDS;
}

interface RestTimerContextValue {
	/** Start (or restart) the rest timer. Defaults to the configured rest length. */
	start: (seconds?: number) => void;
	defaultSeconds: number;
	setDefaultSeconds: (seconds: number) => void;
}

const RestTimerContext = createContext<RestTimerContextValue | null>(null);

export function useRestTimer(): RestTimerContextValue {
	const ctx = useContext(RestTimerContext);
	if (!ctx)
		throw new Error("useRestTimer must be used within RestTimerProvider");
	return ctx;
}

function playChime() {
	if (typeof window === "undefined") return;
	try {
		navigator.vibrate?.([120, 60, 120]);
	} catch {
		/* vibration unsupported */
	}
	try {
		const AudioCtx =
			window.AudioContext ??
			(window as unknown as { webkitAudioContext?: typeof AudioContext })
				.webkitAudioContext;
		if (!AudioCtx) return;
		const audio = new AudioCtx();
		const osc = audio.createOscillator();
		const gain = audio.createGain();
		osc.connect(gain);
		gain.connect(audio.destination);
		osc.type = "sine";
		osc.frequency.value = 880;
		gain.gain.setValueAtTime(0.0001, audio.currentTime);
		gain.gain.exponentialRampToValueAtTime(0.25, audio.currentTime + 0.02);
		gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.5);
		osc.start();
		osc.stop(audio.currentTime + 0.5);
		osc.onended = () => audio.close();
	} catch {
		/* audio unsupported */
	}
}

export function RestTimerProvider({ children }: { children: ReactNode }) {
	const [defaultSeconds, setDefaultSecondsState] = useState(loadDefault);
	const [duration, setDuration] = useState(0);
	const [remaining, setRemaining] = useState(0);
	const [running, setRunning] = useState(false);
	const [showPresets, setShowPresets] = useState(false);
	const endsAtRef = useRef<number | null>(null);

	const setDefaultSeconds = useCallback((seconds: number) => {
		setDefaultSecondsState(seconds);
		if (typeof window !== "undefined") {
			window.localStorage.setItem(STORAGE_KEY, String(seconds));
		}
	}, []);

	const start = useCallback(
		(seconds?: number) => {
			const total = seconds ?? defaultSeconds;
			setDuration(total);
			setRemaining(total);
			endsAtRef.current = Date.now() + total * 1000;
			setRunning(true);
		},
		[defaultSeconds],
	);

	const dismiss = useCallback(() => {
		endsAtRef.current = null;
		setRunning(false);
		setDuration(0);
		setRemaining(0);
		setShowPresets(false);
	}, []);

	const togglePause = useCallback(() => {
		setRunning((prev) => {
			if (prev) {
				endsAtRef.current = null;
				return false;
			}
			endsAtRef.current = Date.now() + remaining * 1000;
			return true;
		});
	}, [remaining]);

	const adjust = useCallback((delta: number) => {
		setRemaining((prev) => {
			const next = Math.max(0, prev + delta);
			if (endsAtRef.current !== null)
				endsAtRef.current = Date.now() + next * 1000;
			setDuration((d) => Math.max(d, next));
			return next;
		});
	}, []);

	// Tick loop — drives the countdown while running.
	useEffect(() => {
		if (!running || endsAtRef.current === null) return;
		const id = window.setInterval(() => {
			if (endsAtRef.current === null) return;
			const left = Math.max(
				0,
				Math.round((endsAtRef.current - Date.now()) / 1000),
			);
			setRemaining(left);
			if (left <= 0) {
				endsAtRef.current = null;
				setRunning(false);
				playChime();
			}
		}, 250);
		return () => window.clearInterval(id);
	}, [running]);

	const value = useMemo<RestTimerContextValue>(
		() => ({ start, defaultSeconds, setDefaultSeconds }),
		[start, defaultSeconds, setDefaultSeconds],
	);

	const active = duration > 0;
	const mins = Math.floor(remaining / 60);
	const secs = remaining % 60;
	const pct = duration > 0 ? (remaining / duration) * 100 : 0;
	const finished = active && remaining <= 0;

	return (
		<RestTimerContext.Provider value={value}>
			{children}
			{active && (
				<div className="fixed inset-x-0 bottom-16 sm:bottom-4 z-50 px-3 sm:px-0 pointer-events-none">
					<div className="pointer-events-auto mx-auto max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] shadow-[var(--shadow-overlay)] overflow-hidden">
						{/* Progress bar */}
						<div className="h-1 w-full bg-[var(--border)]">
							<div
								className={`h-full transition-[width] duration-300 ease-linear ${finished ? "bg-[var(--accent-hover)]" : "bg-[var(--accent)]"}`}
								style={{ width: `${pct}%` }}
							/>
						</div>
						<div className="flex items-center gap-2 p-2.5">
							<div className="flex items-center gap-2 shrink-0">
								<Timer
									size={18}
									className={
										finished
											? "text-[var(--accent-hover)]"
											: "text-[var(--accent)]"
									}
								/>
								<button
									type="button"
									onClick={() => setShowPresets((s) => !s)}
									className="text-xl font-bold tabular-nums text-white tracking-tight"
									aria-label="Rest remaining — tap to change default"
								>
									{finished
										? "Rest done"
										: `${mins}:${String(secs).padStart(2, "0")}`}
								</button>
							</div>

							<div className="flex items-center gap-1.5 ml-auto">
								{!finished && (
									<>
										<button
											type="button"
											onClick={() => adjust(-15)}
											className="h-9 px-2.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-xs font-semibold text-[var(--text-muted)] hover:text-white active:scale-95 transition"
										>
											−15
										</button>
										<button
											type="button"
											onClick={() => adjust(15)}
											className="h-9 px-2.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-xs font-semibold text-[var(--text-muted)] hover:text-white active:scale-95 transition"
										>
											+15
										</button>
										<button
											type="button"
											onClick={togglePause}
											aria-label={
												running ? "Pause rest timer" : "Resume rest timer"
											}
											className="h-9 w-9 flex items-center justify-center rounded-lg bg-[var(--surface)] border border-[var(--border)] text-white active:scale-95 transition"
										>
											{running ? <Pause size={15} /> : <Play size={15} />}
										</button>
									</>
								)}
								{finished && (
									<button
										type="button"
										onClick={() => start(duration)}
										aria-label="Restart rest timer"
										className="h-9 w-9 flex items-center justify-center rounded-lg bg-[var(--surface)] border border-[var(--border)] text-white active:scale-95 transition"
									>
										<RotateCcw size={15} />
									</button>
								)}
								<button
									type="button"
									onClick={dismiss}
									aria-label="Dismiss rest timer"
									className="h-9 w-9 flex items-center justify-center rounded-lg bg-[var(--accent)] text-black active:scale-95 transition"
								>
									<X size={16} />
								</button>
							</div>
						</div>

						{showPresets && (
							<div className="flex items-center gap-1.5 px-2.5 pb-2.5">
								<span className="text-[10px] uppercase tracking-wide text-[var(--text-muted)] mr-1">
									Default
								</span>
								{PRESETS.map((p) => (
									<button
										key={p}
										type="button"
										onClick={() => {
											setDefaultSeconds(p);
											start(p);
											setShowPresets(false);
										}}
										className={`h-8 flex-1 rounded-lg text-xs font-semibold transition ${
											defaultSeconds === p
												? "bg-[var(--accent-dim)] text-[var(--accent)] border border-[var(--accent)]/50"
												: "bg-[var(--surface)] text-[var(--text-muted)] border border-[var(--border)] hover:text-white"
										}`}
									>
										{p < 120 ? `${p}s` : `${p / 60}m`}
									</button>
								))}
							</div>
						)}
					</div>
				</div>
			)}
		</RestTimerContext.Provider>
	);
}
