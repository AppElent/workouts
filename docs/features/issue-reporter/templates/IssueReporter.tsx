import { useState } from "react";
import type { IssueRequest } from "./issue-reporter";

export function IssueReporter({
	submit,
}: {
	submit: (request: IssueRequest) => Promise<{ ok: boolean; error?: string }>;
}) {
	const [text, setText] = useState("");
	const [status, setStatus] = useState<string | null>(null);
	const [pending, setPending] = useState(false);
	async function handleSubmit(event: React.FormEvent) {
		event.preventDefault();
		setPending(true);
		try {
			const result = await submit({
				type: "feedback",
				text,
				url: window.location.href,
			});
			setStatus(result.ok ? "Report sent" : (result.error ?? "Report failed"));
			if (result.ok) setText("");
		} catch {
			setStatus("Report failed");
		} finally {
			setPending(false);
		}
	}
	return (
		<form onSubmit={handleSubmit} aria-label="Report an issue">
			<label>
				Feedback
				<textarea
					required
					minLength={3}
					maxLength={5000}
					value={text}
					onChange={(event) => setText(event.target.value)}
				/>
			</label>
			<button type="submit" disabled={pending}>
				{pending ? "Sending..." : "Send report"}
			</button>
			{status ? <p role="status">{status}</p> : null}
		</form>
	);
}
