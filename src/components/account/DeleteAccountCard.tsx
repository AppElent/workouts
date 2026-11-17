import { useAuth, useUser } from "@clerk/react";
import { api } from "@convex/_generated/api";
import { isAppErrorCode, parseConvexError } from "@foundry/core";
import { useNavigate } from "@tanstack/react-router";
import {
	useAction,
	useConvexConnectionState,
	useMutation,
	useQuery,
} from "convex/react";
import { useEffect, useRef, useState } from "react";
import { Button } from "#/components/ui/button";
import { useConfirm } from "#/components/ui/confirm-dialog";
import { useToast } from "#/components/ui/toast";
import { preloadAppleJs, revokeAppleSignIn } from "#/lib/auth/appleRevocation";
import { useI18n } from "#/lib/i18n";

type Mode = "deleteData" | "deleteAccount";

/**
 * Delete my data and Delete account, as on the mobile Account screen
 * (profile contract). Web keeps no account data outside Convex queries, so
 * after Delete my data every page re-renders empty without a local reset.
 */
export function DeleteAccountCard() {
	const { userId } = useAuth();
	const { user } = useUser();
	const blocker = useQuery(api.account.deletionBlocker, {});
	const deleteData = useMutation(api.account.deleteData);
	const revokeApple = useAction(api.account.revokeAppleSignIn);
	const online = useConvexConnectionState().isWebSocketConnected;
	const {
		locale,
		messages: { account: c, common, errors },
	} = useI18n();
	const confirm = useConfirm();
	const toast = useToast();
	const navigate = useNavigate();
	const pending = useRef(false);
	const [busy, setBusy] = useState<Mode | null>(null);

	// `undefined` while the blocker loads; nothing is deletable until it answers.
	const disabled = !online || blocker !== null || busy !== null;
	const accountDeletable = user?.deleteSelfEnabled ?? false;

	useEffect(() => {
		if (user && accountDeletable) preloadAppleJs(user, locale);
	}, [user, accountDeletable, locale]);

	async function run(mode: Mode) {
		if (pending.current || disabled || !userId || !user) return;
		pending.current = true;
		try {
			const confirmed = await confirm({
				title: c[mode],
				description:
					mode === "deleteData" ? c.deleteDataConfirm : c.deleteAccountConfirm,
				confirmLabel: c[mode],
				cancelLabel: common.actions.cancel,
				destructive: true,
			});
			if (!confirmed) return;
			setBusy(mode);
			if (mode === "deleteAccount") {
				const apple = await revokeAppleSignIn(user, revokeApple, { locale });
				if (apple === "popupBlocked") toast.error(c.deletion.applePopupBlocked);
				if (apple !== "continue") return;
			}
			try {
				// Each batch commits; a retry after an error resumes deleting.
				while (!(await deleteData({ expectedSubject: userId })).done);
			} catch (error) {
				// Known codes only: a raw server message would hide that deleting
				// stopped part-way and can resume.
				const { code } = parseConvexError(error);
				const words: Partial<Record<string, string>> = {
					...errors,
					...c.deletion.refusals,
				};
				toast.error((isAppErrorCode(code) && words[code]) || c.deletion.error);
				return;
			}
			if (mode === "deleteAccount") {
				try {
					// Ends the session.
					await user.delete();
				} catch {
					toast.error(c.deletion.accountError);
					return;
				}
				// The signed-out start; a full load also drops in-memory account state.
				await navigate({ to: "/", replace: true, reloadDocument: true });
				return;
			}
			toast.success(c.deletion.success);
		} finally {
			pending.current = false;
			setBusy(null);
		}
	}

	const status = !online
		? c.deletion.offline
		: blocker
			? c.deletion.refusals[blocker]
			: null;

	return (
		<section
			className="rounded-xl border border-border bg-surface p-4 sm:p-5"
			aria-label={c.deletionTitle}
		>
			<h2 className="text-sm font-semibold text-text">{c.deletionTitle}</h2>
			{status && (
				<p role="status" className="mt-2 text-sm text-text">
					{status}
				</p>
			)}
			<div className="mt-3 divide-y divide-border">
				<DeletionRow
					footer={c.deleteDataFooter}
					action={
						<Button
							variant="destructive"
							disabled={disabled}
							loading={busy === "deleteData"}
							onClick={() => void run("deleteData")}
						>
							{c.deleteData}
						</Button>
					}
				/>
				<DeletionRow
					footer={
						accountDeletable
							? c.deleteAccountFooter
							: c.deleteAccountUnavailable
					}
					action={
						<Button
							variant="destructive"
							disabled={disabled || !accountDeletable}
							loading={busy === "deleteAccount"}
							onClick={() => void run("deleteAccount")}
						>
							{c.deleteAccount}
						</Button>
					}
				/>
			</div>
		</section>
	);
}

function DeletionRow({
	footer,
	action,
}: {
	footer: string;
	action: React.ReactNode;
}) {
	return (
		<div className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
			<p className="text-xs text-text-muted">{footer}</p>
			<div>{action}</div>
		</div>
	);
}
