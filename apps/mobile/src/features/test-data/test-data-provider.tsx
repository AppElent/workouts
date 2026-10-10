import { useAuth } from "@clerk/expo";
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
import { todayIsoDate } from "../../data/calendar-day";
import { foodPhotos } from "../../data/food-photo-manager";
import { clearNutritionDraftAccount } from "../../data/nutrition-draft-repository";
import {
	clearNutritionLibraryAccount,
	nutritionLibraryDatabaseName,
} from "../../data/nutrition-library-repository";
import { clearNutritionLocalAccount } from "../../data/nutrition-local-repository";
import { clearPersonalFoodCache } from "../../data/personal-food-repository";
import { useI18n } from "../../i18n";
import { PrimaryButton } from "../../ui/button";
import { FormScreen } from "../../ui/form";
import { AppText } from "../../ui/text";
import { useToast } from "../../ui/toast";

type Request = { mode: "load" | "clear"; subject: string };
const TestDataContext = createContext<((mode: Request["mode"]) => void) | null>(
	null,
);

function cleanup(subject: string) {
	clearPersonalFoodCache(
		nutritionLibraryDatabaseName(subject),
		foodPhotos.remove,
	);
	clearNutritionLocalAccount(subject, foodPhotos.remove);
	clearNutritionLibraryAccount(subject);
	clearNutritionDraftAccount(subject);
}

/** Unmount data providers while resetting, then reopen them without stale memory. */
export function TestDataProvider({ children }: { children: ReactNode }) {
	const { userId } = useAuth();
	const online = useConvexConnectionState().isWebSocketConnected;
	const reset = useMutation(api.testData.reset);
	const { t } = useI18n();
	const c = t.testData;
	const toast = useToast();
	const [request, setRequest] = useState<Request | null>(null);
	const [cleanupFailed, setCleanupFailed] = useState(false);
	const running = useRef(false);
	const processed = useRef<Request | null>(null);
	const owner = useRef(userId);
	owner.current = userId;
	const finishCleanup = useCallback(
		(subject: string) => {
			try {
				cleanup(subject);
				setRequest(null);
				setCleanupFailed(false);
				toast.success(c.success);
			} catch {
				setCleanupFailed(true);
			}
		},
		[toast, c.success],
	);
	useEffect(() => {
		if (!request || processed.current === request) return;
		processed.current = request;
		running.current = true;
		// This effect runs after the old data providers' unmount cleanup.
		void reset({
			mode: request.mode,
			today: todayIsoDate(),
			expectedSubject: request.subject,
		})
			.then(() => {
				finishCleanup(request.subject);
			})
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
	}, [request, reset, finishCleanup, toast, c]);
	if (request)
		return (
			<FormScreen>
				<AppText variant="heading">{c.title}</AppText>
				{cleanupFailed ? (
					<>
						<AppText accessibilityRole="alert">{c.cleanupError}</AppText>
						<PrimaryButton
							label={c.retryCleanup}
							onPress={() => finishCleanup(request.subject)}
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
		<TestDataContext
			value={(mode) => {
				if (!online || !owner.current || running.current) {
					toast.error(c.offline);
					return;
				}
				setRequest({ mode, subject: owner.current });
			}}
		>
			{children}
		</TestDataContext>
	);
}

export function useTestDataReset() {
	const reset = use(TestDataContext);
	if (!reset) throw new Error("TestDataProvider is missing");
	return reset;
}
