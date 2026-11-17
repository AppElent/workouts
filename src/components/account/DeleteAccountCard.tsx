import { useAuth, useClerk, useReverification, useUser } from "@clerk/react";
import { isReverificationCancelledError } from "@clerk/react/errors";
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
import {
	appleRevocationReturnUrl,
	preloadAppleJs,
	revokeAppleSignIn,
} from "#/lib/auth/appleRevocation";
import { useI18n } from "#/lib/i18n";

type Mode = "deleteData" | "deleteAccount";

/**
 * Clerk's reverification hint (`reverificationError("strict")` in
 * `@clerk/shared`): `useReverification` answers it with Clerk's verify dialog
 * and then calls the wrapped function again.
 */
const NEEDS_RECENT_SIGN_IN = {
	clerk_error: {
		type: "forbidden",
		reason: "reverification-error",
		metadata: { reverification: "strict" },
	},
} as const;

/** The Clerk account and session the person confirmed the deletion in. */
type Confirmed = { userId: string; sessionId: string };

/** Thrown when another account or session is signed in mid-deletion. */
class AccountChanged extends Error {}

/** Whether a reverification-wrapped call ended with Clerk still refusing. */
function stillRefused(result: unknown) {
	return (
		typeof result === "object" && result !== null && "clerk_error" in result
	);
}

/**
 * Delete my data and Delete account, as on the mobile Account screen
 * (profile contract). Web keeps no account data outside Convex queries, so
 * after Delete my data every page re-renders empty without a local reset.
 */
export function DeleteAccountCard() {
	const { userId } = useAuth();
	const { user } = useUser();
	const clerk = useClerk();
	// Clerk deletes an account only after a recent sign-in ("strict": the
	// strongest factor within 10 minutes). Ask for it before anything is
	// deleted, so a stale session doesn't leave the data gone and the account
	// still there. Reads the live session: verifying replaces it.
	const recentSignIn = () =>
		clerk.session?.checkAuthorization({ reverification: "strict" }) ?? false;
	// Every Clerk step re-checks the live identity, also on Clerk's retry, so
	// a sign-in to another account in another tab is never deleted.
	const sameAccount = (confirmed: Confirmed) =>
		clerk.user?.id === confirmed.userId &&
		clerk.session?.id === confirmed.sessionId;
	const confirmRecentSignIn = useReverification(
		async (confirmed: Confirmed) => {
			if (!sameAccount(confirmed)) throw new AccountChanged();
			return recentSignIn() ? true : NEEDS_RECENT_SIGN_IN;
		},
	);
	// Still wrapped: the window can lapse while a large deletion runs.
	const deleteUser = useReverification(async (confirmed: Confirmed) => {
		if (!sameAccount(confirmed)) throw new AccountChanged();
		return clerk.user?.delete();
	});
	const blocker = useQuery(api.account.deletionBlocker, {});
	// The latest blocker, for steps that run after the confirmation.
	const blockerNow = useRef(blocker);
	useEffect(() => {
		blockerNow.current = blocker;
	}, [blocker]);
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
			const account: Confirmed | null = clerk.session
				? { userId, sessionId: clerk.session.id }
				: null;
			if (mode === "deleteAccount") {
				if (!account || !sameAccount(account)) {
					toast.error(c.deletion.accountChanged);
					return;
				}
				const verifying = !recentSignIn();
				try {
					// Clerk retries once after its dialog and returns that result
					// as is: anything but `true` means the sign-in is still old.
					if ((await confirmRecentSignIn(account)) !== true) {
						toast.error(c.deletion.signInCheckError);
						return;
					}
				} catch (error) {
					// Cancelling the dialog deletes nothing, like cancelling the
					// confirmation.
					if (error instanceof AccountChanged)
						toast.error(c.deletion.accountChanged);
					else if (!isReverificationCancelledError(error))
						toast.error(c.deletion.signInCheckError);
					return;
				}
				// Clerk's dialog ends outside the person's click, so the browser
				// would block Apple's popup; ask for a fresh click first.
				if (
					verifying &&
					appleRevocationReturnUrl(user) &&
					!(await confirm({
						title: c.deleteAccount,
						description: c.deletion.appleContinue,
						confirmLabel: c.deleteAccount,
						cancelLabel: common.actions.cancel,
						destructive: true,
					}))
				)
					return;
				// A blocker can appear while the dialogs are open; Apple's grant
				// can't be restored, so check before revoking it.
				const blocked = blockerNow.current;
				if (blocked !== null) {
					toast.error(
						blocked ? c.deletion.refusals[blocked] : c.deletion.error,
					);
					return;
				}
				if (!sameAccount(account)) {
					toast.error(c.deletion.accountChanged);
					return;
				}
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
			// `account` is set for Delete account: it stops above without one.
			if (mode === "deleteAccount" && account) {
				try {
					// Ends the session. Clerk can still refuse after its dialog.
					if (stillRefused(await deleteUser(account))) {
						toast.error(c.deletion.signInAgain);
						return;
					}
				} catch (error) {
					toast.error(
						error instanceof AccountChanged
							? c.deletion.accountChanged
							: isReverificationCancelledError(error)
								? c.deletion.signInAgain
								: c.deletion.accountError,
					);
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
