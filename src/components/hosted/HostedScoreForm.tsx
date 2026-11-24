import {
	formatMovement,
	type HostedLevel,
	hostedLevelLabel,
	type WodScoreInput,
} from "@foundry/core";
import { useState } from "react";
import { type HostedWodBlock, movementKey } from "#/components/hosted/wodBlock";
import {
	useWodScoreDraft,
	WodScoreFields,
} from "#/components/wods/WodScoreFields";
import { useConvexErrorMessage } from "#/lib/convexError";
import { useMessages } from "#/lib/i18n";
import { type WodScoreError, wodScoreFromForm } from "#/lib/wodScore";

export type HostedScorePayload = {
	wodBlockId: string;
	level: HostedLevel;
	notes?: string;
} & WodScoreInput;

type Props = {
	wodBlocks: Omit<HostedWodBlock, "wodId">[];
	submitLabel?: string;
	onSubmit: (payload: HostedScorePayload) => Promise<unknown>;
};

export function HostedScoreForm({ wodBlocks, submitLabel, onSubmit }: Props) {
	const messages = useMessages();
	const t = messages.hosted.scoreForm;
	const [wodBlockId, setWodBlockId] = useState(wodBlocks[0]?.blockId ?? "");
	const selectedWod =
		wodBlocks.find((block) => block.blockId === wodBlockId) ?? wodBlocks[0];
	const [level, setLevel] = useState<HostedLevel>("rx");
	const selectedLevelMovements =
		selectedWod?.levels.find((entry) => entry.level === level)?.movements ?? [];
	const score = useWodScoreDraft();
	const errorMessage = useConvexErrorMessage();
	const [notes, setNotes] = useState("");
	const [saving, setSaving] = useState(false);
	const [message, setMessage] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [scoreError, setScoreError] = useState<WodScoreError | null>(null);

	async function handleSubmit(event: React.FormEvent) {
		event.preventDefault();
		if (!selectedWod || saving) return;

		const built = wodScoreFromForm(selectedWod.type, score.fields);
		if (!built.ok) {
			setScoreError(built.error);
			setError(null);
			setMessage(null);
			return;
		}

		setSaving(true);
		setError(null);
		setScoreError(null);
		setMessage(null);
		try {
			await onSubmit({
				wodBlockId: selectedWod.blockId,
				level,
				notes: notes.trim() || undefined,
				...built.score,
			});
			setNotes("");
			setMessage(t.submitted);
		} catch (err) {
			setError(errorMessage(err, t.failed));
		} finally {
			setSaving(false);
		}
	}

	if (wodBlocks.length === 0) {
		return (
			<div className="rounded-lg border border-border bg-surface p-4 text-sm text-text-muted">
				{t.noWods}
			</div>
		);
	}

	return (
		<form
			onSubmit={(event) => void handleSubmit(event)}
			className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4"
		>
			<h2 className="text-sm font-semibold text-text">{t.title}</h2>

			<label className="flex flex-col gap-1 text-xs font-medium uppercase text-text-muted">
				{t.wod}
				<select
					value={wodBlockId}
					onChange={(event) => setWodBlockId(event.target.value)}
					className="h-10 rounded-lg border border-border bg-surface-2 px-3 text-sm normal-case text-text"
				>
					{wodBlocks.map((block) => (
						<option key={block.blockId} value={block.blockId}>
							{block.name}
						</option>
					))}
				</select>
			</label>

			<div className="grid grid-cols-4 gap-2">
				{(selectedWod?.levels ?? []).map((entry) => (
					<button
						key={entry.level}
						type="button"
						onClick={() => setLevel(entry.level)}
						className={[
							"h-10 rounded-lg border text-xs font-semibold",
							level === entry.level
								? "border-accent-ink bg-accent-dim text-accent-ink"
								: "border-border bg-surface-2 text-text-muted",
						].join(" ")}
					>
						{hostedLevelLabel(selectedWod.levels, entry.level)}
					</button>
				))}
			</div>

			{selectedLevelMovements.length > 0 && (
				<ul className="rounded-lg bg-surface-2 px-3 py-2 text-xs text-text-muted">
					{selectedLevelMovements.map((movement) => (
						<li key={movementKey(level, movement)}>
							{formatMovement(movement)}
						</li>
					))}
				</ul>
			)}

			{selectedWod && (
				<WodScoreFields
					type={selectedWod.type}
					draft={score.draft}
					onChange={score.update}
				/>
			)}

			<textarea
				placeholder={t.notes}
				value={notes}
				onChange={(event) => setNotes(event.target.value)}
				rows={2}
				className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-text placeholder:text-text-muted"
			/>

			<button
				type="submit"
				disabled={saving}
				className="h-11 rounded-lg bg-accent-fill text-sm font-bold text-on-accent disabled:opacity-50"
			>
				{saving ? t.submitting : (submitLabel ?? t.submit)}
			</button>
			{message && <p className="text-sm text-accent-ink">{message}</p>}
			{(scoreError || error) && (
				<p className="text-sm text-danger">
					{scoreError ? messages.wods.scoreErrors[scoreError] : error}
				</p>
			)}
		</form>
	);
}
