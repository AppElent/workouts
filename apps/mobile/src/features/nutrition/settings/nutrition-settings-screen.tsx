import { useConvexConnectionState } from "convex/react";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { foodPhotos } from "../../../data/food-photo-manager";
import { useOpenFoodFacts } from "../../../data/open-food-facts-context";
import {
	type OffRefreshProgress,
	openFoodFactsImports,
	refreshOpenFoodFactsImports,
} from "../../../data/open-food-facts-sync";
import { usePersonalFoods } from "../../../data/personal-foods";
import { fmt, useI18n } from "../../../i18n";
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
import { useWriteFailureMessage } from "../../../ui/use-screen-write";
import { LocalDataSettingsPanel } from "./local-data-settings-panel";

export function NutritionSettingsScreen() {
	const styles = useThemedStyles(createStyles);
	const { t } = useI18n();
	const router = useRouter();
	const copy = t.nutrition.settings;
	const foods = usePersonalFoods();
	const openFoodFacts = useOpenFoodFacts();
	const toast = useToast();
	const writeFailureMessage = useWriteFailureMessage();
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
			await foods.account.loadEntireLibrary();
			await refreshOpenFoodFactsImports({
				foods: openFoodFactsImports(foods.list()),
				refreshBarcode: openFoodFacts.refreshBarcode,
				importPhoto: foodPhotos.importRemote,
				update: foods.update,
				onProgress: setOffProgress,
				onPhotoFailure: () => toast.error(copy.offPhotoFailure),
			});
		} catch (error) {
			toast.error(writeFailureMessage(error, copy.failure));
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
					label={copy.manageMeasures}
					onPress={() => router.push("/personal-measures")}
				/>
			</FormSection>
			<GroupedSurface style={styles.card}>
				<AppText variant="caption">{copy.photoNotice}</AppText>
			</GroupedSurface>
			<LocalDataSettingsPanel key={foods.account.subject ?? "signed-out"} />
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
							{fmt(copy.offProgress, {
								completed: offProgress.completed,
								total: offProgress.total,
							})}
						</AppText>
						{offProgress.completed === offProgress.total ? (
							<AppText variant="caption">
								{fmt(copy.offSummary, {
									updated: offProgress.updated,
									unchanged: offProgress.unchanged,
									failed: offProgress.failed,
								})}
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
