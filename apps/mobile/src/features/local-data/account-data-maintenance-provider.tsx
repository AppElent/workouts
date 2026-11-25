import { useAuth, useUser } from "@clerk/expo";
import { useMutation } from "convex/react";
import {
	createContext,
	type ReactNode,
	use,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import { ActivityIndicator } from "react-native";
import {
	type AppleRevocation,
	leaveSignedOutNotice,
} from "../../auth/signed-out-notice";
import { api } from "../../convex/api";
import { useOnline } from "../../convex/online";
import { AppQueryCacheProvider } from "../../convex/query-cache";
import { todayIsoDate } from "../../dates/calendar-day";
import { useI18n } from "../../i18n";
import { clearAccountStores } from "../../local-store/local-store";
import { PrimaryButton } from "../../ui/button";
import { FormScreen } from "../../ui/form";
import { AppText } from "../../ui/text";
import { useToast } from "../../ui/toast";
import { writeFailureMessage } from "../../ui/use-screen-write";
import { isRecentSignInRefusal } from "../profile/recent-sign-in";

type Request = {
	mode: "load" | "clear" | "deleteData" | "deleteAccount";
	subject: string;
	/** Delete account only: how Sign in with Apple ended, for the notice. */
	apple?: AppleRevocation;
};
const AccountDataContext = createContext<
	((mode: Request["mode"], apple?: AppleRevocation) => void) | null
>(null);

/** Unmount data providers while resetting, then reopen them without stale memory. */
export function AccountDataMaintenanceProvider({
	children,
}: {
	children: ReactNode;
}) {
	const { userId, sessionId, signOut } = useAuth();
	const online = useOnline();
	const reset = useMutation(api.testData.reset);
	const deleteData = useMutation(api.account.deleteData);
	const { user } = useUser();
	const { t } = useI18n();

	const toast = useToast();
	const [request, setRequest] = useState<Request | null>(null);
	const deleting =
		request?.mode === "deleteData" || request?.mode === "deleteAccount";
	const c = deleting ? t.account.deletion : t.testData;
	const [cleanupFailed, setCleanupFailed] = useState(false);
	const running = useRef(false);
	const processed = useRef<Request | null>(null);
	const owner = useRef(userId);
	owner.current = userId;
	const finishCleanup = useCallback(
		async (subject: string) => {
			try {
				clearAccountStores(subject);
			} catch {
				// clearAccountStores reported what failed; the screen offers a retry.
				setCleanupFailed(true);
				return;
			}
			setCleanupFailed(false);
			if (request?.mode === "deleteData") {
				// Delete Foundry data only: the shared AppElent login stays, so no
				// `user.delete()` and no Apple revocation; this device signs out.
				// Signing out unmounts this layout and its toasts, so the sign-in
				// screen shows the confirmation instead.
				leaveSignedOutNotice("dataDeleted");
				try {
					await signOut();
				} catch {
					leaveSignedOutNotice(null);
					toast.error(t.account.deletion.signOutError);
					setRequest(null);
					return;
				}
				setRequest(null);
				return;
			}
			if (request?.mode === "deleteAccount") {
				// Ends the session; the signed-in layout then redirects to sign-in,
				// which shows the confirmation.
				leaveSignedOutNotice({
					kind: "accountDeleted",
					apple: request.apple ?? "notLinked",
				});
				try {
					// No user: nothing was deleted, so no confirmation either.
					if (!user) throw new Error("No Clerk user to delete");
					await user.delete();
				} catch (error) {
					leaveSignedOutNotice(null);
					// The sign-in was checked before the data went, but the window
					// can lapse while a large deletion runs.
					toast.error(
						isRecentSignInRefusal(error)
							? t.account.deletion.signInToFinish
							: t.account.deletion.accountError,
					);
					setRequest(null);
					return;
				}
				setRequest(null);
				return;
			}
			setRequest(null);
			toast.success(t.testData.success);
		},
		[
			toast,
			request?.mode,
			request?.apple,
			user,
			signOut,
			t.account.deletion,
			t.testData,
		],
	);
	useEffect(() => {
		if (!request || processed.current === request) return;
		processed.current = request;
		running.current = true;
		// This effect runs after the old data providers' unmount cleanup.
		const { mode, subject } = request;
		const remote =
			mode === "load" || mode === "clear"
				? reset({ mode, today: todayIsoDate(), expectedSubject: subject })
				: (async () => {
						// Each batch commits; a retry after an error resumes deleting.
						while (!(await deleteData({ expectedSubject: subject })).done);
					})();
		void remote
			.then(() => finishCleanup(subject))
			.catch((error) => {
				const refusals = "refusals" in c ? c.refusals : {};
				toast.error(
					writeFailureMessage(error, { ...t.errors, ...refusals }, c.error),
				);
				setRequest(null);
			})
			.finally(() => {
				running.current = false;
			});
	}, [request, reset, deleteData, finishCleanup, toast, c, t.errors]);
	if (request)
		return (
			<FormScreen>
				<AppText variant="heading">{c.title}</AppText>
				{cleanupFailed ? (
					<>
						<AppText accessibilityRole="alert">{c.cleanupError}</AppText>
						<PrimaryButton
							label={c.retryCleanup}
							onPress={() => void finishCleanup(request.subject)}
						/>
					</>
				) : (
					<>
						<ActivityIndicator />
						<AppText>{c.pending}</AppText>
					</>
				)}
			</FormScreen>
		);
	return (
		<AccountDataContext
			value={(mode, apple) => {
				if (!online || !owner.current || running.current) {
					toast.error(
						mode === "load" || mode === "clear"
							? t.testData.offline
							: t.account.deletion.offline,
					);
					return;
				}
				setRequest({ mode, subject: owner.current, apple });
			}}
		>
			<AppQueryCacheProvider scope={sessionId ?? userId ?? "signed-out"}>
				{children}
			</AppQueryCacheProvider>
		</AccountDataContext>
	);
}

export function useTestDataReset() {
	const reset = use(AccountDataContext);
	if (!reset) throw new Error("AccountDataMaintenanceProvider is missing");
	return reset;
}

/**
 * Permanently deletes the account's Foundry data, then signs out
 * (`deleteData`, the AppElent login stays) or deletes the AppElent login
 * (`deleteAccount`, with how Sign in with Apple ended for the notice).
 */
export function useAccountDeletion() {
	const maintain = use(AccountDataContext);
	if (!maintain) throw new Error("AccountDataMaintenanceProvider is missing");
	return (mode: "deleteData" | "deleteAccount", apple?: AppleRevocation) =>
		maintain(mode, apple);
}
