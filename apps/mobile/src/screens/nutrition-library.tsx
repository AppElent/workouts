import { useConvexConnectionState, useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { api } from "../convex/api";
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
import { SkeletonBlock, SkeletonGroup } from "../ui/skeleton";
import { AppText } from "../ui/text";
import { useToast } from "../ui/toast";
import { nutritionLibraryCopy } from "./nutrition-library-copy";

type ServerPage = {
	page: Parameters<
		ReturnType<typeof usePersonalFoods>["backup"]["receiveServerPage"]
	>[0];
	isDone: boolean;
	continueCursor: string;
};

function isServerPage(value: unknown): value is ServerPage {
	return (
		!!value && typeof value === "object" && "page" in value && "isDone" in value
	);
}

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
	const [cursor, setCursor] = useState<string | null>(null);
	const [restoreVersion, setRestoreVersion] = useState(0);
	const [offRefreshing, setOffRefreshing] = useState(false);
	const [offProgress, setOffProgress] = useState<OffRefreshProgress>();
	const received = useRef(new Set<string>());
	const { isWebSocketConnected } = useConvexConnectionState();
	const result = useQuery(
		api.nutritionLibrary.list,
		foods.backup.enabled
			? { paginationOpts: { cursor, numItems: 50 } }
			: "skip",
	);
	useEffect(() => {
		if (!isServerPage(result)) return;
		const key = `${restoreVersion}:${cursor ?? "first"}:${JSON.stringify(result.page.map((record) => [record.id, record.revision, record.deleted, record.payload]))}`;
		if (received.current.has(key)) return;
		try {
			foods.backup.receiveServerPage(result.page);
			received.current.add(key);
			if (!result.isDone) setCursor(result.continueCursor);
		} catch {
			toast.error(copy.failure);
		}
	}, [copy.failure, cursor, foods.backup, restoreVersion, result, toast]);
	const restore = () => {
		received.current.clear();
		setCursor(null);
		setRestoreVersion((version) => version + 1);
	};
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

	if (foods.backup.enabled && result === undefined) {
		return (
			<ScrollView
				contentInsetAdjustmentBehavior="automatic"
				style={styles.root}
				contentContainerStyle={styles.content}
			>
				<SkeletonGroup label={copy.loading}>
					<SkeletonBlock height={80} />
					<SkeletonBlock height={180} />
				</SkeletonGroup>
				{!isWebSocketConnected ? (
					<GroupedSurface style={styles.card}>
						<AppText>{copy.offline}</AppText>
						<TextAction label={copy.restore} onPress={restore} />
					</GroupedSurface>
				) : null}
			</ScrollView>
		);
	}
	return (
		<ScrollView
			contentInsetAdjustmentBehavior="automatic"
			style={styles.root}
			contentContainerStyle={styles.content}
		>
			<AppText variant="caption">{copy.intro}</AppText>
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
									{operation.lastError ? ` · ${operation.lastError}` : ""}
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
