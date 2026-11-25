import { useState } from "react";
import {
	HostedScoreForm,
	type HostedScorePayload,
} from "#/components/hosted/HostedScoreForm";
import type { HostedWodBlock } from "#/components/hosted/wodBlock";
import { useMessages } from "#/lib/i18n";

export function GuestSubmissionForm({
	wodBlocks,
	onSubmit,
}: {
	wodBlocks: Omit<HostedWodBlock, "wodId">[];
	onSubmit: (
		payload: HostedScorePayload & { guestName: string },
	) => Promise<unknown>;
}) {
	const t = useMessages().hosted.guest;
	const [guestName, setGuestName] = useState("");

	return (
		<div className="flex flex-col gap-3">
			<label className="flex flex-col gap-1 text-xs font-medium uppercase text-text-muted">
				{t.name}
				<input
					type="text"
					value={guestName}
					onChange={(event) => setGuestName(event.target.value)}
					placeholder={t.namePlaceholder}
					className="h-10 rounded-lg border border-border bg-surface-2 px-3 text-sm normal-case text-text placeholder:text-text-muted"
				/>
			</label>
			<HostedScoreForm
				wodBlocks={wodBlocks}
				submitLabel={t.submit}
				onSubmit={(payload) => onSubmit({ guestName, ...payload })}
			/>
		</div>
	);
}
