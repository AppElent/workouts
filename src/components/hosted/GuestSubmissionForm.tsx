import { useState } from "react";
import { HostedScoreForm } from "#/components/hosted/HostedScoreForm";
import type {
	HostedLevel,
	HostedScore,
	HostedWodType,
} from "#/lib/hostedWorkouts";

type WodBlock = {
	blockId: string;
	name: string;
	type: HostedWodType;
	levels: { level: HostedLevel; label: string }[];
};

type SubmitPayload = {
	guestName: string;
	wodBlockId: string;
	level: HostedLevel;
	notes?: string;
} & HostedScore;

export function GuestSubmissionForm({
	wodBlocks,
	onSubmit,
}: {
	wodBlocks: WodBlock[];
	onSubmit: (payload: SubmitPayload) => Promise<unknown>;
}) {
	const [guestName, setGuestName] = useState("");

	return (
		<div className="flex flex-col gap-3">
			<label className="flex flex-col gap-1 text-xs font-medium uppercase text-[var(--text-muted)]">
				Guest name
				<input
					type="text"
					value={guestName}
					onChange={(event) => setGuestName(event.target.value)}
					placeholder="Name on leaderboard"
					className="h-10 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm normal-case text-white placeholder:text-[var(--text-muted)]"
				/>
			</label>
			<HostedScoreForm
				wodBlocks={wodBlocks}
				submitLabel="Submit guest score"
				onSubmit={(payload) => onSubmit({ guestName, ...payload })}
			/>
		</div>
	);
}
