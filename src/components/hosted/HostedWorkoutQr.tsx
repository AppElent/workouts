import { Clipboard, Radio } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";

export function HostedWorkoutQr({ url }: { url: string }) {
	const [copied, setCopied] = useState(false);

	async function copyJoinLink() {
		if (!url || typeof navigator === "undefined") return;
		await navigator.clipboard.writeText(url);
		setCopied(true);
		window.setTimeout(() => setCopied(false), 1600);
	}

	return (
		<section className="rounded-lg border border-border bg-surface p-4">
			<div className="flex items-center gap-2 text-sm font-semibold text-text">
				<Radio size={16} />
				Join code
			</div>
			<div className="mt-4 flex justify-center rounded-lg bg-white p-3">
				{url && <QRCodeSVG value={url} size={220} />}
			</div>
			<div className="mt-3 break-all rounded-lg border border-border px-3 py-2 text-xs text-text-muted">
				{url}
			</div>
			<button
				type="button"
				onClick={copyJoinLink}
				className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-semibold text-text"
			>
				<Clipboard size={15} />
				{copied ? "Copied" : "Copy link"}
			</button>
		</section>
	);
}
