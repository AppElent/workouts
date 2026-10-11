import { useAuth } from "@clerk/clerk-react";
import { api } from "@convex/_generated/api";
import { useConvexConnectionState, useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { format } from "date-fns";
import { useRef, useState } from "react";
import { Button } from "#/components/ui/button";
import { useConfirm } from "#/components/ui/confirm-dialog";
import { useToast } from "#/components/ui/toast";
import { useMessages } from "#/lib/i18n";

export function TestDataCard() {
	const { userId } = useAuth();
	const status = useQuery(api.testData.availability, {});
	const reset = useMutation(api.testData.reset);
	const online = useConvexConnectionState().isWebSocketConnected;
	const { testData: c } = useMessages();
	const confirm = useConfirm();
	const toast = useToast();
	const pending = useRef(false);
	const [busy, setBusy] = useState<"load" | "clear" | null>(null);
	async function run(mode: "load" | "clear") {
		if (
			pending.current ||
			!userId ||
			!online ||
			!status?.available ||
			status.blocker
		)
			return;
		pending.current = true;
		try {
			if (
				!(await confirm({
					title: c[mode],
					description: `${mode === "load" ? c.loadConfirm : c.clearConfirm} ${c.preserved}`,
					confirmLabel: c[mode],
					cancelLabel: c.cancel,
					destructive: true,
				}))
			)
				return;
			setBusy(mode);
			await reset({
				mode,
				today: format(new Date(), "yyyy-MM-dd"),
				expectedSubject: userId,
			});
			// Web reads personal data reactively from Convex and has no durable food cache.
			toast.success(c.success);
		} catch (error) {
			const reason = error instanceof ConvexError ? error.data : null;
			toast.error(
				typeof reason === "string" && Object.hasOwn(c, reason)
					? c[reason as keyof typeof c]
					: c.error,
			);
		} finally {
			pending.current = false;
			setBusy(null);
		}
	}
	if (!status?.available) return null;
	return (
		<section
			className="rounded-xl border border-border bg-card p-4 space-y-3"
			aria-label={c.title}
		>
			<h2 className="text-lg font-semibold">{c.title}</h2>
			<p className="text-sm text-muted-foreground">{c.description}</p>
			{status.blocker ? (
				<p role="status">{c[status.blocker]}</p>
			) : !online ? (
				<p role="status">{c.offline}</p>
			) : null}
			<div className="flex flex-wrap gap-3">
				<Button
					disabled={!!busy || !!status.blocker || !online}
					loading={busy === "load"}
					onClick={() => void run("load")}
				>
					{c.load}
				</Button>
				<Button
					variant="destructive"
					disabled={!!busy || !!status.blocker || !online}
					loading={busy === "clear"}
					onClick={() => void run("clear")}
				>
					{c.clear}
				</Button>
			</div>
		</section>
	);
}
