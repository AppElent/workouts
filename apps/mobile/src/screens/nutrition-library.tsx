import { useConvexConnectionState } from "convex/react";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { foodPhotos } from "../data/food-photo-manager";
import { useOpenFoodFacts } from "../data/open-food-facts-context";
import {
	type OffRefreshProgress,
	openFoodFactsImports,
	refreshOpenFoodFactsImports,
} from "../data/open-food-facts-sync";
import { usePersonalFoods } from "../data/personal-foods";
import { useI18n } from "../i18n";
import { spacing, type Tokens, useThemedStyles } from "../theme";
import { PrimaryButton } from "../ui/button";
import { useConfirm } from "../ui/confirm-dialog";
import {
	DisclosureRow,
	FormSection,
	GroupedSurface,
	TextAction,
} from "../ui/form";
import { AppText } from "../ui/text";
import { useToast } from "../ui/toast";
import { nutritionLibraryCopy } from "./nutrition-library-copy";

function conflictName(
	conflict: ReturnType<typeof usePersonalFoods>["backup"]["conflicts"][number],
	locale: "en" | "nl",
	copy: { unnamedFood: string; unnamedCombo: string },
) {
	const payload = conflict.localPayload ?? conflict.serverPayload;
	if (payload) {
		try {
			const parsed: unknown = JSON.parse(payload);
			if (parsed && typeof parsed === "object" && "name" in parsed) {
				const name = parsed.name;
				if (typeof name === "string" && name.trim()) return name;
				if (name && typeof name === "object" && locale in name) {
					const localized: unknown = Reflect.get(name, locale);
					if (typeof localized === "string" && localized.trim())
						return localized;
				}
			}
		} catch {
			// The service records the conflict even when an old payload is malformed.
		}
	}
	return conflict.record.kind === "food" ? copy.unnamedFood : copy.unnamedCombo;
}

export function NutritionSettingsScreen() {
	const styles = useThemedStyles(createStyles);
	const { locale } = useI18n();
	const router = useRouter();
	const copy = nutritionLibraryCopy[locale];
	const foods = usePersonalFoods();
	const openFoodFacts = useOpenFoodFacts();
	const toast = useToast();
	const confirm = useConfirm();
	const resolveWithServer = foods.backup.useServerCopy;
	const [offRefreshing, setOffRefreshing] = useState(false);
	const [offProgress, setOffProgress] = useState<OffRefreshProgress>();
	const { isWebSocketConnected } = useConvexConnectionState();
	const restore = foods.backup.restore;
	const retryUpload = () => {
		foods.backup.retry();
	};
	const keepDeviceCopy = (
		conflict: ReturnType<
			typeof usePersonalFoods
		>["backup"]["conflicts"][number],
	) => {
		try {
			foods.backup.keepDeviceCopy(conflict);
		} catch {
			toast.error(copy.failure);
		}
	};
	const applyServerCopy = async (
		conflict: ReturnType<
			typeof usePersonalFoods
		>["backup"]["conflicts"][number],
	) => {
		const name = conflictName(conflict, locale, copy);
		if (
			!(await confirm({
				title: copy.confirmServerTitle,
				message: copy.confirmServerBody(name),
				confirmLabel: copy.confirmServer,
				destructive: true,
			}))
		)
			return;
		try {
			resolveWithServer(conflict);
		} catch {
			toast.error(copy.failure);
		}
	};

	const enable = async () => {
		if (
			!(await confirm({
				title: copy.confirmEnableTitle,
				message: copy.confirmEnableBody,
				confirmLabel: copy.confirmEnable,
			}))
		)
			return;
		try {
			foods.backup.enable();
			toast.success(copy.ready);
		} catch {
			toast.error(copy.failure);
		}
	};
	const importLegacy = async () => {
		if (
			!(await confirm({
				title: copy.confirmImportTitle,
				message: copy.confirmImportBody,
				confirmLabel: copy.confirmImport,
			}))
		)
			return;
		try {
			foods.backup.importLegacy();
			toast.success(copy.imported);
		} catch {
			toast.error(copy.failure);
		}
	};
	const importedFoods = openFoodFactsImports(foods.list());
	const refreshImports = async () => {
		if (offRefreshing || importedFoods.length === 0) return;
		if (
			!(await confirm({
				title: copy.offConfirmTitle,
				message: copy.offConfirmBody(importedFoods.length),
				confirmLabel: copy.offConfirm,
			}))
		)
			return;
		setOffRefreshing(true);
		setOffProgress(undefined);
		try {
			await refreshOpenFoodFactsImports({
				foods: importedFoods,
				refreshBarcode: openFoodFacts.refreshBarcode,
				importPhoto: foodPhotos.importRemote,
				update: foods.update,
				onProgress: setOffProgress,
				onPhotoFailure: () => toast.error(copy.offPhotoFailure),
			});
		} catch {
			toast.error(copy.failure);
		} finally {
			setOffRefreshing(false);
		}
	};

	return (
		<ScrollView
			contentInsetAdjustmentBehavior="automatic"
			style={styles.root}
			contentContainerStyle={styles.content}
		>
			<AppText variant="caption">{copy.intro}</AppText>
			{foods.backup.enabled && !isWebSocketConnected ? (
				<GroupedSurface style={styles.card}>
					<AppText>{copy.offline}</AppText>
				</GroupedSurface>
			) : null}
			{foods.backup.restoreError ? (
				<GroupedSurface style={styles.card}>
					<AppText accessibilityRole="alert">{copy.failure}</AppText>
					<TextAction label={copy.restore} onPress={restore} />
				</GroupedSurface>
			) : null}
			<FormSection>
				<DisclosureRow
					label={
						locale === "nl"
							? "Persoonlijke maten beheren"
							: "Manage personal measures"
					}
					onPress={() => router.push("/personal-measures")}
				/>
			</FormSection>
			<GroupedSurface style={styles.card}>
				<AppText variant="caption">{copy.photoNotice}</AppText>
			</GroupedSurface>
			<GroupedSurface style={styles.card}>
				<AppText variant="heading">{copy.offTitle}</AppText>
				<AppText variant="caption">
					{importedFoods.length ? copy.offHelp : copy.offEmpty}
				</AppText>
				<TextAction
					label={offRefreshing ? copy.offRefreshing : copy.offRefresh}
					disabled={offRefreshing || importedFoods.length === 0}
					onPress={() => void refreshImports()}
				/>
				{offProgress ? (
					<View style={styles.offStatus} accessibilityLiveRegion="polite">
						<AppText variant="caption">
							{copy.offProgress(offProgress.completed, offProgress.total)}
						</AppText>
						{offProgress.completed === offProgress.total ? (
							<AppText variant="caption">
								{copy.offSummary(
									offProgress.updated,
									offProgress.unchanged,
									offProgress.failed,
								)}
							</AppText>
						) : null}
					</View>
				) : null}
			</GroupedSurface>
			{!foods.backup.enabled ? (
				<GroupedSurface style={styles.card}>
					<AppText>{copy.disabled}</AppText>
					<PrimaryButton label={copy.enable} onPress={() => void enable()} />
				</GroupedSurface>
			) : (
				<>
					<GroupedSurface style={styles.card}>
						<AppText variant="heading">{copy.import}</AppText>
						<AppText variant="caption">{copy.importHelp}</AppText>
						<PrimaryButton
							label={copy.import}
							onPress={() => void importLegacy()}
						/>
						<TextAction label={copy.restore} onPress={restore} />
						<TextAction label={copy.retryUpload} onPress={retryUpload} />
					</GroupedSurface>
					{foods.backup.operations.length ? (
						<GroupedSurface style={styles.card}>
							<AppText variant="heading">{copy.pending}</AppText>
							{foods.backup.operations.map((operation) => (
								<AppText key={operation.operationId} variant="caption">
									{operation.status}
									{operation.lastError ? ` · ${copy.failure}` : ""}
								</AppText>
							))}
						</GroupedSurface>
					) : null}
					{foods.backup.conflicts.length ? (
						<GroupedSurface style={styles.card}>
							<AppText variant="heading">{copy.conflicts}</AppText>
							{foods.backup.conflicts.map((conflict) => {
								const name = conflictName(conflict, locale, copy);
								return (
									<View key={conflict.record.id} style={styles.conflict}>
										<AppText>{name}</AppText>
										<PrimaryButton
											label={copy.keep}
											onPress={() => keepDeviceCopy(conflict)}
										/>
										<TextAction
											label={copy.server}
											onPress={() => void applyServerCopy(conflict)}
										/>
									</View>
								);
							})}
						</GroupedSurface>
					) : null}
				</>
			)}
		</ScrollView>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		root: { flex: 1, backgroundColor: colors.bg },
		content: {
			padding: spacing.lg,
			gap: spacing.md,
			paddingBottom: spacing.xl,
		},
		card: { gap: spacing.sm },
		conflict: {
			gap: spacing.sm,
			borderTopWidth: 1,
			borderTopColor: colors.border,
			paddingTop: spacing.sm,
		},
		offStatus: { gap: spacing.xs },
	});
