/**
 * `useToast()` — the phone's counterpart to the web's `src/components/ui/toast.tsx`.
 *
 * The rule this exists to enforce: a mutation that fails must say so. A tap
 * that appears to do nothing is the worst outcome available, and it is the
 * default one if nobody catches the throw.
 *
 * Success toasts are the exception, not the habit — only when the result isn't
 * already visible on screen. A logged set that appears in the table announces
 * itself; a cancelled session that vanishes does not need a receipt.
 */
import {
	createContext,
	type ReactNode,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radius, spacing } from "../theme";
import { AppText } from "./text";

type ToastKind = "error" | "success";
type Toast = { id: number; kind: ToastKind; message: string };

type ToastApi = {
	error: (message: string) => void;
	success: (message: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

/** Long enough to read a sentence, short enough not to sit in the way. */
const DISMISS_MS = 4000;

export function ToastProvider({ children }: { children: ReactNode }) {
	const [toast, setToast] = useState<Toast | null>(null);
	const insets = useSafeAreaInsets();

	// Keyed on the toast's id so a second toast restarts the clock rather than
	// inheriting the remainder of the first one's.
	useEffect(() => {
		if (!toast) return;
		const timer = setTimeout(() => setToast(null), DISMISS_MS);
		return () => clearTimeout(timer);
	}, [toast]);

	const api = useMemo<ToastApi>(() => {
		const push = (kind: ToastKind) => (message: string) =>
			setToast({ id: Date.now(), kind, message });
		return { error: push("error"), success: push("success") };
	}, []);

	return (
		<ToastContext.Provider value={api}>
			{children}
			{toast ? (
				<View
					style={[styles.wrap, { top: insets.top + spacing.sm }]}
					pointerEvents="box-none"
				>
					<Pressable
						onPress={() => setToast(null)}
						style={[
							styles.toast,
							toast.kind === "error" ? styles.error : styles.success,
						]}
					>
						<AppText variant="body" style={styles.text}>
							{toast.message}
						</AppText>
					</Pressable>
				</View>
			) : null}
		</ToastContext.Provider>
	);
}

export function useToast() {
	const api = useContext(ToastContext);
	if (!api) throw new Error("useToast must be used inside <ToastProvider>");
	return api;
}

const styles = StyleSheet.create({
	wrap: {
		position: "absolute",
		left: spacing.md,
		right: spacing.md,
		zIndex: 100,
	},
	toast: {
		borderRadius: radius.lg,
		borderWidth: 1,
		paddingVertical: spacing.sm + 2,
		paddingHorizontal: spacing.md,
	},
	error: {
		backgroundColor: colors.dangerSoft,
		borderColor: colors.danger,
	},
	success: {
		backgroundColor: colors.accentDim,
		borderColor: colors.accent,
	},
	text: { color: colors.text },
});
