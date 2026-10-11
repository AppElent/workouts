import { useConvex, useConvexConnectionState } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { api } from "../../../convex/api";
import { foodPhotos } from "../../../data/food-photo-manager";
import { useOpenFoodFacts } from "../../../data/open-food-facts-context";
import {
	type OffRefreshProgress,
	openFoodFactsImports,
	refreshOpenFoodFactsImports,
} from "../../../data/open-food-facts-sync";
import { usePersonalFoods } from "../../../data/personal-foods";
import { useI18n } from "../../../i18n";
import { spacing, type Tokens, useThemedStyles } from "../../../theme";
import { useConfirm } from "../../../ui/confirm-dialog";
import {
	DisclosureRow,
	FormSection,
	GroupedSurface,
	TextAction,
} from "../../../ui/form";
import { AppText } from "../../../ui/text";
import { useToast } from "../../../ui/toast";
import { LocalDataUploadPanel } from "./local-data-upload-panel";
import { nutritionLibraryCopy } from "./nutrition-library-copy";

export function NutritionSettingsScreen() {
	const styles = useThemedStyles(createStyles);
	const { locale } = useI18n();
	const router = useRouter();
	const copy = nutritionLibraryCopy[locale];
	const foods = usePersonalFoods();
	const client = useConvex();
	const openFoodFacts = useOpenFoodFacts();
	const toast = useToast();
	const confirm = useConfirm();
	const [offRefreshing, setOffRefreshing] = useState(false);
	const [offProgress, setOffProgress] = useState<OffRefreshProgress>();
	const { isWebSocketConnected } = useConvexConnectionState();
	const refreshImports = async () => {
		if (offRefreshing || !isWebSocketConnected) return;
		if (
			!(await confirm({
				title: copy.offConfirmTitle,
				message: copy.offHelp,
				confirmLabel: copy.offConfirm,
			}))
		)
			return;
		setOffRefreshing(true);
		setOffProgress(undefined);
		try {
			// This explicit management action may enumerate the library. Ordinary navigation
			// never does. Apply bounded pages to the existing cache, then refresh each import.
			let cursor: string | null = null;
			for (;;) {
				const page: FunctionReturnType<typeof api.nutritionLibrary.browse> =
					await client.query(api.nutritionLibrary.browse, {
						query: "",
						paginationOpts: { cursor, numItems: 100 },
					});
				foods.account.receiveServerPage(page.page);
				if (page.isDone) break;
				cursor = page.continueCursor;
			}
			await refreshOpenFoodFactsImports({
				foods: openFoodFactsImports(foods.list()),
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
			{!isWebSocketConnected ? (
				<GroupedSurface style={styles.card}>
					<AppText>{copy.offline}</AppText>
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
			<LocalDataUploadPanel key={foods.account.subject ?? "signed-out"} />
			<GroupedSurface style={styles.card}>
				<AppText variant="heading">{copy.offTitle}</AppText>
				<AppText variant="caption">{copy.offHelp}</AppText>
				<TextAction
					label={offRefreshing ? copy.offRefreshing : copy.offRefresh}
					disabled={offRefreshing || !isWebSocketConnected}
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
		offStatus: { gap: spacing.xs },
	});
