import { useState } from "react";
import {
	HostedScoreForm,
	type HostedScorePayload,
} from "#/components/hosted/HostedScoreForm";
import type { HostedWodBlock } from "#/components/hosted/wodBlock";

export function GuestSubmissionForm({
	wodBlocks,
	onSubmit,
}: {
	wodBlocks: Omit<HostedWodBlock, "wodId">[];
	onSubmit: (
		payload: HostedScorePayload & { guestName: string },
	) => Promise<unknown>;
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
