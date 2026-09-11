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
import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useI18n } from "../i18n";
import { colors, radius, spacing } from "../theme";
import { GhostButton } from "../ui/button";
import { AppText } from "../ui/text";

export function BarcodeScanner({
	onScanned,
	onCancel,
}: {
	onScanned: (barcode: string) => void;
	onCancel: () => void;
}) {
	const { t } = useI18n();
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
			<SafeAreaView style={styles.overlay} pointerEvents="box-none">
				<Pressable
					onPress={onCancel}
					accessibilityRole="button"
					accessibilityLabel={t.nutrition.entryActions.close}
					style={styles.overlayBack}
				>
					<AppText style={styles.overlayText}>
						{t.nutrition.entryActions.close}
					</AppText>
				</Pressable>
				<View style={styles.hintBar}>
					<AppText style={styles.overlayText}>
						{t.nutrition.barcode.hint}
					</AppText>
				</View>
			</SafeAreaView>
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
	const { t } = useI18n();
	return (
		<SafeAreaView style={styles.shell}>
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
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
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
		alignSelf: "flex-start",
		minHeight: 44,
		paddingHorizontal: spacing.md,
		justifyContent: "center",
		borderRadius: radius.pill,
		backgroundColor: "rgba(10, 11, 9, 0.6)",
	},
	overlayText: { color: colors.text },
	hintBar: {
		alignSelf: "center",
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.sm,
		borderRadius: radius.md,
		backgroundColor: "rgba(10, 11, 9, 0.6)",
		marginBottom: spacing.xl,
	},
	shell: {
		flex: 1,
		backgroundColor: colors.bg,
		padding: 20,
		paddingTop: 12,
		gap: spacing.md,
	},
	back: {
		minHeight: 44,
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.sm,
	},
});
