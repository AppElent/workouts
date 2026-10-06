import { Dialog } from "@base-ui/react/dialog";
import * as Sentry from "@sentry/react";
import { useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "#/components/ui/button";
import { useToast } from "#/components/ui/toast";
import { useMessages } from "#/lib/i18n";

export function ReportProblem() {
	const { common } = useMessages();
	const text = common.feedback;
	const toast = useToast();
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const [message, setMessage] = useState("");
	const [screenshot, setScreenshot] = useState<File>();
	const [preview, setPreview] = useState<string>();
	const [screen, setScreen] = useState("/");
	const [pending, setPending] = useState(false);
	useEffect(() => {
		if (!screenshot) {
			setPreview(undefined);
			return;
		}
		const url = URL.createObjectURL(screenshot);
		setPreview(url);
		return () => URL.revokeObjectURL(url);
	}, [screenshot]);

	async function submit(event: React.FormEvent) {
		event.preventDefault();
		if (pending || !message.trim()) return;
		setPending(true);
		try {
			if (!Sentry.getClient()?.getOptions().enabled)
				throw new Error("Reporting disabled");
			const attachments = screenshot
				? [
						{
							filename: `feedback-screenshot.${screenshot.type === "image/png" ? "png" : screenshot.type === "image/webp" ? "webp" : "jpg"}`,
							contentType: screenshot.type,
							data: new Uint8Array(await screenshot.arrayBuffer()),
						},
					]
				: undefined;
			await Sentry.sendFeedback(
				{
					message: message.trim(),
					tags: { screen },
					// A route template supplies context without IDs/query parameters.
					url: new URL(screen, window.location.origin).href,
				},
				{ attachments, includeReplay: true },
			);
			setOpen(false);
			setMessage("");
			setScreenshot(undefined);
			toast.success(text.success);
		} catch {
			toast.error(text.error);
		} finally {
			setPending(false);
		}
	}

	return (
		<Dialog.Root
			open={open}
			onOpenChange={(next) => {
				if (pending) return;
				if (next) setScreen(router.state.matches.at(-1)?.routeId || "/");
				setOpen(next);
			}}
		>
			<Dialog.Trigger render={<Button variant="outline" />}>
				{text.report}
			</Dialog.Trigger>
			<Dialog.Portal>
				<Dialog.Backdrop className="fixed inset-0 z-50 bg-black/60" />
				<Dialog.Popup className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl bg-[var(--bg)] p-6 text-white shadow-xl max-h-[90vh] overflow-y-auto">
					<Dialog.Title className="text-lg font-semibold">
						{text.report}
					</Dialog.Title>
					<Dialog.Description className="my-3 text-sm text-[var(--text-muted)]">
						{text.description}
					</Dialog.Description>
					<form onSubmit={submit} className="flex flex-col gap-4">
						<label className="flex flex-col gap-2">
							{text.message}
							<textarea
								required
								maxLength={4000}
								value={message}
								disabled={pending}
								onChange={(event) => setMessage(event.target.value)}
								placeholder={text.placeholder}
								className="min-h-28 rounded-lg border border-[var(--border)] bg-transparent p-3"
							/>
						</label>
						{preview ? (
							<>
								<img
									src={preview}
									alt={text.add}
									className="max-h-48 object-contain"
								/>
								<Button
									type="button"
									variant="ghost"
									disabled={pending}
									onClick={() => setScreenshot(undefined)}
								>
									{text.remove}
								</Button>
							</>
						) : (
							<label className="flex flex-col gap-2 text-sm">
								{text.add}
								<input
									type="file"
									accept="image/png,image/jpeg,image/webp"
									disabled={pending}
									onChange={(event) => {
										const file = event.target.files?.[0];
										if (
											file &&
											(!["image/png", "image/jpeg", "image/webp"].includes(
												file.type,
											) ||
												file.size > 5 * 1024 * 1024)
										) {
											toast.error(text.attachmentError);
											event.target.value = "";
											return;
										}
										setScreenshot(file);
									}}
								/>
							</label>
						)}
						<div className="flex justify-end gap-2">
							<Dialog.Close
								render={<Button variant="ghost" disabled={pending} />}
							>
								{text.cancel}
							</Dialog.Close>
							<Button
								type="submit"
								loading={pending}
								disabled={!message.trim()}
							>
								{text.submit}
							</Button>
						</div>
					</form>
				</Dialog.Popup>
			</Dialog.Portal>
		</Dialog.Root>
	);
}
