/**
 * The Scan barcode screen (spec #68).
 *
 * Camera permission is requested here, in this screen's own effect — never on
 * mount of the food browser it is pushed from — so the request only ever
 * fires after the user has actually invoked Scan. Every branch below (still
 * requesting, refused, restricted) keeps a visible way back to the food
 * browser, where local Search and Enter manually already live; this screen
 * never becomes a dead end.
 */
import { CameraView, useCameraPermissions } from "expo-camera";
import { SymbolView } from "expo-symbols";
import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useI18n } from "../../../i18n";
import {
	radius,
	spacing,
	type Tokens,
	useThemedStyles,
	useTokens,
} from "../../../theme";
import { GhostButton } from "../../../ui/button";
import { AppText } from "../../../ui/text";

export function BarcodeScanner({
	onScanned,
	onCancel,
	status,
}: {
	onScanned: (barcode: string) => void;
	onCancel: () => void;
	/**
	 * What happens to the code just read, such as an Open Food Facts lookup.
	 * Shown in the camera instead of the aiming hint, so the person never
	 * faces an empty screen while it runs.
	 */
	status?: string;
}) {
	const styles = useThemedStyles(createStyles);
	const { t } = useI18n();
	// Explicit insets: inside a full-screen Modal the overlay's SafeAreaView
	// measured none, which put Close under the status bar.
	const insets = useSafeAreaInsets();
	const colors = useTokens();
	const [permission, requestPermission] = useCameraPermissions();
	const requested = useRef(false);
	const scanned = useRef(false);

	useEffect(() => {
		if (requested.current) return;
		requested.current = true;
		requestPermission();
	}, [requestPermission]);

	if (!permission || permission.status === "undetermined") {
		return (
			<Shell onCancel={onCancel} title={t.nutrition.barcode.scanTitle}>
				<AppText variant="caption">{t.nutrition.barcode.purpose}</AppText>
				<AppText>{t.nutrition.barcode.requesting}</AppText>
			</Shell>
		);
	}

	if (!permission.granted) {
		return (
			<Shell onCancel={onCancel} title={t.nutrition.barcode.scanTitle}>
				<AppText variant="caption">{t.nutrition.barcode.purpose}</AppText>
				<AppText accessibilityRole="alert">
					{permission.canAskAgain
						? t.nutrition.barcode.denied
						: t.nutrition.barcode.restricted}
				</AppText>
				{permission.canAskAgain ? (
					<GhostButton
						label={t.nutrition.barcode.allow}
						onPress={requestPermission}
					/>
				) : null}
			</Shell>
		);
	}

	return (
		<View style={styles.root}>
			<CameraView
				style={styles.camera}
				facing="back"
				barcodeScannerSettings={{
					barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e", "code128"],
				}}
				onBarcodeScanned={(result) => {
					if (scanned.current) return;
					scanned.current = true;
					onScanned(result.data);
				}}
			/>
			<View
				style={[
					styles.overlay,
					{
						paddingTop: insets.top + spacing.sm,
						paddingBottom: insets.bottom + spacing.md,
					},
				]}
				pointerEvents="box-none"
			>
				<Pressable
					onPress={onCancel}
					accessibilityRole="button"
					accessibilityLabel={t.nutrition.entryActions.close}
					hitSlop={4}
					style={[styles.overlayBack, { top: insets.top + spacing.sm }]}
				>
					<SymbolView
						name={{ ios: "xmark", android: "close", web: "close" }}
						size={17}
						weight="semibold"
						tintColor={colors.onMedia}
					/>
				</Pressable>
				<AppText
					variant="navTitle"
					accessibilityRole="header"
					style={[styles.overlayText, styles.overlayTitle]}
				>
					{t.nutrition.barcode.scanTitle}
				</AppText>
				{/* The aiming frame (design `.cam .frame`). */}
				<View pointerEvents="none" style={styles.frame} />
				<View
					style={styles.hintBar}
					accessibilityLiveRegion={status ? "polite" : undefined}
				>
					<AppText style={styles.overlayText}>
						{status ?? t.nutrition.barcode.hint}
					</AppText>
				</View>
			</View>
		</View>
	);
}

function Shell({
	title,
	onCancel,
	children,
}: {
	title: string;
	onCancel: () => void;
	children: ReactNode;
}) {
	const insets = useSafeAreaInsets();
	const styles = useThemedStyles(createStyles);
	const { t } = useI18n();
	return (
		<View
			style={[
				styles.shell,
				{ paddingTop: insets.top + 12, paddingBottom: insets.bottom },
			]}
		>
			<Pressable
				onPress={onCancel}
				accessibilityRole="button"
				accessibilityLabel={t.nutrition.entryActions.close}
				style={styles.back}
			>
				<AppText>{t.nutrition.entryActions.close}</AppText>
			</Pressable>
			<AppText variant="title">{title}</AppText>
			{children}
		</View>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		root: { flex: 1, backgroundColor: colors.bg },
		camera: { flex: 1 },
		overlay: {
			position: "absolute",
			top: 0,
			left: 0,
			right: 0,
			bottom: 0,
			justifyContent: "space-between",
			padding: spacing.md,
		},
		overlayBack: {
			position: "absolute",
			left: spacing.md,
			width: 44,
			height: 44,
			alignItems: "center",
			justifyContent: "center",
			borderRadius: radius.pill,
			backgroundColor: colors.mediaScrim,
		},
		overlayTitle: { alignSelf: "center", lineHeight: 44 },
		frame: {
			alignSelf: "center",
			width: 220,
			height: 110,
			borderRadius: 18,
			borderWidth: 3,
			borderColor: colors.onMedia,
		},
		overlayText: { color: colors.onMedia },
		hintBar: {
			alignSelf: "center",
			paddingHorizontal: spacing.md,
			paddingVertical: spacing.sm,
			borderRadius: radius.md,
			backgroundColor: colors.mediaScrim,
			marginBottom: spacing.xl,
		},
		shell: {
			flex: 1,
			backgroundColor: colors.bg,
			padding: 20,
			gap: spacing.md,
		},
		back: {
			minHeight: 44,
			flexDirection: "row",
			alignItems: "center",
			gap: spacing.sm,
		},
	});
