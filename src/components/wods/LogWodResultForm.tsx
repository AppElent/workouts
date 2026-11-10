import { api } from "@convex/_generated/api";
import type { Doc, Id } from "@convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { useState } from "react";
import {
	useWodScoreDraft,
	WodScoreFields,
} from "#/components/wods/WodScoreFields";
import { getConvexErrorMessage } from "#/lib/convexError";
import { wodScoreFromForm } from "#/lib/wodScore";

interface Props {
	wodId: Id<"wods">;
	type: Doc<"wods">["type"];
	sessionId?: Id<"workoutSessions">;
	onLogged?: () => void;
}

export function LogWodResultForm({ wodId, type, sessionId, onLogged }: Props) {
	const log = useMutation(api.wodResults.log);

	const [rxScaled, setRxScaled] = useState<"rx" | "scaled">("rx");
	const score = useWodScoreDraft();
	const [notes, setNotes] = useState("");
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		const built = wodScoreFromForm(type, score.fields);
		if (!built.ok) {
			setError(built.message);
			return;
		}
		setSaving(true);
		setError(null);
		try {
			await log({
				wodId,
				sessionId,
				rxScaled,
				notes: notes.trim() || undefined,
				...built.score,
			});
			setNotes("");
			onLogged?.();
		} catch (err) {
			setError(getConvexErrorMessage(err, "Failed to log result."));
		} finally {
			setSaving(false);
		}
	}

	return (
		<form
			onSubmit={(e) => void handleSubmit(e)}
			className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-5 flex flex-col gap-3"
		>
			<h2 className="text-sm font-semibold text-white">Log Result</h2>

			<WodScoreFields type={type} draft={score.draft} onChange={score.update} />

			<div className="flex gap-2">
				{(["rx", "scaled"] as const).map((v) => (
					<button
						key={v}
						type="button"
						onClick={() => setRxScaled(v)}
						className={[
							"flex-1 h-9 rounded-lg text-xs font-medium uppercase transition-all",
							rxScaled === v
								? "bg-[var(--accent-dim)] text-[var(--accent)] border border-[var(--accent)]/50"
								: "bg-[var(--surface-2)] text-[var(--text-muted)] border border-[var(--border)] hover:text-white",
						].join(" ")}
					>
						{v}
					</button>
				))}
			</div>

			<textarea
				placeholder="Notes (optional)"
				value={notes}
				onChange={(e) => setNotes(e.target.value)}
				rows={2}
				className="rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
			/>

			<button
				type="submit"
				disabled={saving}
				className="w-full h-11 rounded-full bg-[var(--accent)] text-black text-sm font-bold disabled:opacity-40 hover:bg-[var(--accent-hover)] transition-colors"
			>
				Log Result
			</button>
			{error && <p className="text-sm text-red-400">{error}</p>}
		</form>
	);
}
