import { useAuth, useUser } from "@clerk/expo";
import { useConvexConnectionState, useMutation } from "convex/react";
import { ConvexError } from "convex/values";
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
import { api } from "../../convex/api";
import { AppQueryCacheProvider } from "../../convex/query-cache";
import { todayIsoDate } from "../../data/calendar-day";
import {
	clearNutritionAccountCache,
	retireLegacyNutritionData,
} from "../../data/nutrition-account-cleanup";
import { clearNutritionLocalAccount } from "../../data/nutrition-local-repository";
import { discardPersonalFoodSources } from "../../data/personal-food-session";
import { useI18n } from "../../i18n";
import { PrimaryButton } from "../../ui/button";
import { FormScreen, TextAction } from "../../ui/form";
import { AppText } from "../../ui/text";
import { useToast } from "../../ui/toast";
import { clearAccountSetDrafts } from "../strength-session/data/set-drafts";

type Request = {
	mode: "load" | "clear" | "local" | "deleteData" | "deleteAccount";
	subject: string;
};
const AccountDataContext = createContext<
	((mode: Request["mode"]) => void) | null
>(null);

function cleanup(subject: string) {
	clearAccountSetDrafts(subject);
	discardPersonalFoodSources(subject);
	clearNutritionLocalAccount(subject);
}

/** Unmount data providers while resetting, then reopen them without stale memory. */
export function AccountDataMaintenanceProvider({
	children,
}: {
	children: ReactNode;
}) {
	const { userId, sessionId } = useAuth();
	useEffect(() => {
		retireLegacyNutritionData();
	}, []);
	const online = useConvexConnectionState().isWebSocketConnected;
	const reset = useMutation(api.testData.reset);
	const deleteData = useMutation(api.account.deleteData);
	const { user } = useUser();
	const { t } = useI18n();

	const toast = useToast();
	const [request, setRequest] = useState<Request | null>(null);
	const deleting =
		request?.mode === "deleteData" || request?.mode === "deleteAccount";
	const c =
		request?.mode === "local"
			? t.localData.maintenance
			: deleting
				? t.account.deletion
				: t.testData;
	const [cleanupFailed, setCleanupFailed] = useState(false);
	const running = useRef(false);
	const processed = useRef<Request | null>(null);
	const owner = useRef(userId);
	owner.current = userId;
	const finishCleanup = useCallback(
		async (subject: string) => {
			try {
				if (request?.mode === "local") clearNutritionAccountCache(subject);
				else cleanup(subject);
			} catch {
				setCleanupFailed(true);
				return;
			}
			setCleanupFailed(false);
			if (request?.mode === "deleteAccount") {
				try {
					// Ends the session; the signed-in layout then redirects to sign-in.
					await user?.delete();
				} catch {
					toast.error(t.account.deletion.accountError);
					setRequest(null);
					return;
				}
			}
			setRequest(null);
			toast.success(c.success);
		},
		[toast, c.success, request?.mode, user, t.account.deletion.accountError],
	);
	useEffect(() => {
		if (!request || processed.current === request) return;
		processed.current = request;
		running.current = true;
		// This effect runs after the old data providers' unmount cleanup.
		const { mode, subject } = request;
		const remote =
			mode === "local"
				? Promise.resolve()
				: mode === "load" || mode === "clear"
					? reset({ mode, today: todayIsoDate(), expectedSubject: subject })
					: (async () => {
							// Each batch commits; a retry after an error resumes deleting.
							while (!(await deleteData({ expectedSubject: subject })).done);
						})();
		void remote
			.then(() => finishCleanup(subject))
			.catch((error) => {
				const reason = error instanceof ConvexError ? error.data : null;
				toast.error(
					typeof reason === "string" && Object.hasOwn(c, reason)
						? c[reason as keyof typeof c]
						: c.error,
				);
				setRequest(null);
			})
			.finally(() => {
				running.current = false;
			});
	}, [request, reset, deleteData, finishCleanup, toast, c]);
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
						{request.mode === "local" ? (
							<TextAction
								label={t.localData.maintenance.back}
								onPress={() => {
									setCleanupFailed(false);
									setRequest(null);
								}}
							/>
						) : null}
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
			value={(mode) => {
				if (!online || !owner.current || running.current) {
					toast.error(
						mode === "local"
							? t.localData.maintenance.offline
							: mode === "load" || mode === "clear"
								? t.testData.offline
								: t.account.deletion.offline,
					);
					return;
				}
				setRequest({ mode, subject: owner.current });
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

/** Permanently deletes the account's personal data, optionally then the account. */
export function useAccountDeletion() {
	const maintain = use(AccountDataContext);
	if (!maintain) throw new Error("AccountDataMaintenanceProvider is missing");
	return (mode: "deleteData" | "deleteAccount") => maintain(mode);
}

export function useLocalDataCleanup() {
	const maintain = use(AccountDataContext);
	if (!maintain) throw new Error("AccountDataMaintenanceProvider is missing");
	return () => maintain("local");
}
