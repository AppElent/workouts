/**
 * The camera for AI entry: a nutrition label (with an aiming frame) or a meal.
 *
 * Permission is requested when this screen opens, never earlier. Every state
 * keeps the photo library as a way forward, so a declined camera is not a
 * dead end (design: designs/nutrition/ai-entry_final.html, section 5).
 */
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { SymbolView } from "expo-symbols";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
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

export function FoodPhotoCamera({
	mode,
	onPhoto,
	onCancel,
}: {
	mode: "label" | "meal";
	/** A local file URI from the camera or the library. */
	onPhoto: (uri: string) => void;
	onCancel: () => void;
}) {
	const styles = useThemedStyles(createStyles);
	const colors = useTokens();
	const insets = useSafeAreaInsets();
	const { t } = useI18n();
	const copy = t.nutrition.assistance;
	const [permission, requestPermission] = useCameraPermissions();
	const requested = useRef(false);
	const camera = useRef<CameraView>(null);
	const [busy, setBusy] = useState(false);

	useEffect(() => {
		if (requested.current) return;
		requested.current = true;
		requestPermission();
	}, [requestPermission]);

	async function pickFromLibrary() {
		const result = await ImagePicker.launchImageLibraryAsync({
			mediaTypes: ["images"],
			quality: 1,
			exif: false,
		});
		const uri = result.canceled ? undefined : result.assets[0]?.uri;
		if (uri) onPhoto(uri);
	}

	async function takePhoto() {
		if (busy || !camera.current) return;
		setBusy(true);
		try {
			const picture = await camera.current.takePictureAsync({ quality: 0.9 });
			if (picture?.uri) onPhoto(picture.uri);
		} finally {
			setBusy(false);
		}
	}

	const close = (
		<Pressable
			onPress={onCancel}
			accessibilityRole="button"
			accessibilityLabel={t.nutrition.entryActions.close}
			hitSlop={4}
			style={[styles.round, { top: insets.top + spacing.sm, left: spacing.md }]}
		>
			<SymbolView
				name={{ ios: "xmark", android: "close", web: "close" }}
				size={17}
				weight="semibold"
				tintColor={colors.onMedia}
			/>
		</Pressable>
	);
	const library = (
		<Pressable
			onPress={() => void pickFromLibrary()}
			accessibilityRole="button"
			accessibilityLabel={copy.chooseFromLibrary}
			style={styles.libraryButton}
		>
			<SymbolView
				name={{
					ios: "photo.on.rectangle",
					android: "photo_library",
					web: "photo_library",
				}}
				size={20}
				tintColor={colors.onMedia}
			/>
		</Pressable>
	);

	if (!permission?.granted) {
		return (
			<View
				style={[
					styles.shell,
					{
						paddingTop: insets.top + spacing.xxl * 2,
						paddingBottom: insets.bottom,
					},
				]}
			>
				{close}
				<AppText variant="caption">{copy.cameraPurpose}</AppText>
				<AppText accessibilityRole={permission ? "alert" : undefined}>
					{!permission || permission.status === "undetermined"
						? copy.cameraRequesting
						: permission.canAskAgain
							? copy.cameraDenied
							: copy.cameraRestricted}
				</AppText>
				{permission?.status === "denied" && permission.canAskAgain ? (
					<GhostButton label={copy.cameraAllow} onPress={requestPermission} />
				) : null}
				<GhostButton
					label={copy.chooseFromLibrary}
					onPress={() => void pickFromLibrary()}
				/>
			</View>
		);
	}

	return (
		<View style={styles.root}>
			<CameraView ref={camera} style={styles.camera} facing="back" />
			<View style={StyleSheet.absoluteFill} pointerEvents="box-none">
				{close}
				<View
					style={[styles.hint, { top: insets.top + 72 }]}
					pointerEvents="none"
				>
					<AppText variant="heading" style={styles.onMedia}>
						{mode === "label" ? copy.labelHint : copy.mealHint}
					</AppText>
					{mode === "label" ? (
						<AppText variant="caption" style={styles.onMedia}>
							{copy.labelHintDetail}
						</AppText>
					) : null}
				</View>
				{mode === "label" ? (
					<View pointerEvents="none" style={styles.frame} />
				) : null}
				<View style={[styles.controls, { bottom: insets.bottom + spacing.xl }]}>
					{library}
					<Pressable
						onPress={() => void takePhoto()}
						accessibilityRole="button"
						accessibilityLabel={copy.takePhoto}
						accessibilityState={{ busy }}
						style={styles.shutter}
					>
						{busy ? (
							<ActivityIndicator color={colors.onMedia} />
						) : (
							<View style={styles.shutterInner} />
						)}
					</Pressable>
					<View style={styles.libraryButton} />
				</View>
			</View>
		</View>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		root: { flex: 1, backgroundColor: "black" },
		camera: { flex: 1 },
		round: {
			position: "absolute",
			width: 44,
			height: 44,
			alignItems: "center",
			justifyContent: "center",
			borderRadius: radius.pill,
			backgroundColor: colors.mediaScrim,
			zIndex: 1,
		},
		hint: {
			position: "absolute",
			left: spacing.lg,
			right: spacing.lg,
			alignItems: "center",
			gap: 4,
		},
		onMedia: { color: colors.onMedia, textAlign: "center" },
		frame: {
			position: "absolute",
			left: spacing.xl,
			right: spacing.xl,
			top: "30%",
			height: "32%",
			borderRadius: 22,
			borderWidth: 2,
			borderColor: colors.onMedia,
		},
		controls: {
			position: "absolute",
			left: spacing.xl,
			right: spacing.xl,
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "space-between",
		},
		shutter: {
			width: 76,
			height: 76,
			borderRadius: 38,
			borderWidth: 4,
			borderColor: colors.onMedia,
			alignItems: "center",
			justifyContent: "center",
		},
		shutterInner: {
			width: 60,
			height: 60,
			borderRadius: 30,
			backgroundColor: colors.onMedia,
		},
		libraryButton: {
			width: 48,
			height: 48,
			borderRadius: 24,
			alignItems: "center",
			justifyContent: "center",
			backgroundColor: colors.mediaScrim,
		},
		shell: {
			flex: 1,
			backgroundColor: colors.bg,
			padding: spacing.lg,
			gap: spacing.md,
		},
	});
