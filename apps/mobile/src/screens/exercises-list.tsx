import type { Exercise } from "@workouts/core/exercises";
import { useMutation } from "convex/react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useEffect, useMemo, useState } from "react";
import {
	Platform,
	Pressable,
	SectionList,
	StyleSheet,
	View,
} from "react-native";
import { api } from "../convex/api";
import { useShellData } from "../data/session-data";
import { useI18n } from "../i18n";
import {
	PREFERENCE_KEYS,
	readPreference,
	writePreference,
} from "../prefs/local-preference";
import {
	radius,
	spacing,
	type Tokens,
	useThemedStyles,
	useTokens,
} from "../theme";
import { convexErrorMessage, useConfirm } from "../ui/confirm-dialog";
import { EmptyState } from "../ui/empty-state";
import { FormSearchField } from "../ui/form";
import { MuscleIcon } from "../ui/muscle-icon";
import { Segmented } from "../ui/segmented";
import { SkeletonGroup, SkeletonList } from "../ui/skeleton";
import { SwipeableRow } from "../ui/swipeable-row";
import { AppText } from "../ui/text";
import { useToast } from "../ui/toast";
import { FiltersSheet } from "./exercise-library/filters-sheet";
import { LayoutMenu } from "./exercise-library/layout-menu";
import {
	emptyFilters,
	type Filters,
	filterExercises,
	GROUP_KEYS,
	type Layout,
	primaryGroup,
} from "./exercise-library/model";

export function ExercisesScreen() {
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	const router = useRouter();
	const toast = useToast();
	const confirm = useConfirm();
	const { t } = useI18n();
	const c = t.exercises;
	const { exercises } = useShellData();
	const removeExercise = useMutation(api.exercises.remove);
	const [search, setSearch] = useState("");
	const { created } = useLocalSearchParams<{ created?: string }>();
	const [scope, setScope] = useState("all");
	const [filters, setFilters] = useState(emptyFilters);
	const [draft, setDraft] = useState<Filters | null>(null);
	useEffect(() => {
		if (created) {
			setSearch(created);
			setScope("personal");
			setFilters(emptyFilters());
			router.setParams({ created: undefined });
		}
	}, [created, router]);
	const [layout, setLayout] = useState<Layout>(() =>
		readPreference(PREFERENCE_KEYS.exerciseLibraryLayout) === "groups"
			? "groups"
			: "list",
	);
	const [deleting, setDeleting] = useState<string | null>(null);
	const filtered = useMemo(
		() =>
			filterExercises(exercises ?? [], search, scope === "personal", filters),
		[exercises, search, scope, filters],
	);
	const sections = useMemo(
		() =>
			layout === "list"
				? filtered.length
					? [{ key: "all", title: "", data: filtered }]
					: []
				: [...GROUP_KEYS, "other" as const]
						.map((group) => ({
							key: group,
							title: c.groupNames[group],
							data: filtered.filter((ex) => primaryGroup(ex) === group),
						}))
						.filter((s) => s.data.length),
		[filtered, layout, c.groupNames],
	);
	const filterCount =
		filters.groups.length +
		filters.equipment.length +
		(filters.category === "all" ? 0 : 1);
	const changeLayout = (next: Layout) => {
		setLayout(next);
		writePreference(PREFERENCE_KEYS.exerciseLibraryLayout, next);
	};
	const clear = () => {
		setSearch("");
		setFilters(emptyFilters());
	};
	const add = () => router.push("/exercise-new");
	const open = (exercise: Exercise) =>
		router.push({ pathname: "/exercise/[id]", params: { id: exercise._id } });
	const remove = async (exercise: Exercise) => {
		if (deleting) return;
		if (
			!(await confirm({
				title: c.deleteTitle.replace("{name}", exercise.name),
				message: c.deleteBody,
				confirmLabel: c.delete,
				cancelLabel: c.cancel,
				destructive: true,
			}))
		)
			return;
		setDeleting(exercise._id);
		try {
			await removeExercise({ id: exercise._id });
		} catch (error) {
			toast.error(convexErrorMessage(error, c.deleteError));
		} finally {
			setDeleting(null);
		}
	};
	return (
		<>
			<SectionList
				style={styles.root}
				contentContainerStyle={styles.content}
				contentInsetAdjustmentBehavior="automatic"
				automaticallyAdjustKeyboardInsets
				// Preserve UIKit's negative large-title offset during keyboard adjustment.
				// RN otherwise clamps against contentInset, excluding adjustedContentInset.
				scrollToOverflowEnabled
				keyboardDismissMode="interactive"
				keyboardShouldPersistTaps="handled"
				stickySectionHeadersEnabled={false}
				sections={sections}
				keyExtractor={(item) => item._id}
				ListHeaderComponent={
					<View style={styles.header}>
						<View style={styles.search}>
							<FormSearchField
								label={c.search}
								value={search}
								onChangeText={setSearch}
								placeholder={c.search}
								autoCorrect={false}
								returnKeyType="search"
								clearButtonMode="while-editing"
							/>
						</View>
						<Segmented
							value={scope}
							onChange={setScope}
							options={[
								{ value: "all", label: c.all },
								{ value: "personal", label: c.personal },
							]}
						/>
						<View style={styles.summary}>
							<AppText variant="footnote" style={{ color: colors.textMuted }}>
								{(filtered.length === 1 ? c.countOne : c.count).replace(
									"{count}",
									String(filtered.length),
								)}
							</AppText>
							<Pressable
								accessibilityRole="button"
								accessibilityLabel={`${c.filters}${filterCount ? `, ${filterCount}` : ""}`}
								onPress={() =>
									setDraft({
										...filters,
										groups: [...filters.groups],
										equipment: [...filters.equipment],
									})
								}
								style={styles.filterButton}
							>
								<SymbolView
									name={{
										ios: "line.3.horizontal.decrease",
										android: "filter_list",
										web: "filter_list",
									}}
									tintColor={colors.accent}
									size={18}
								/>
								<AppText variant="control" style={{ color: colors.accent }}>
									{c.filters}
									{filterCount ? ` · ${filterCount}` : ""}
								</AppText>
							</Pressable>
						</View>
					</View>
				}
				renderSectionHeader={({ section }) =>
					section.title ? (
						<View style={styles.sectionHeader}>
							<AppText variant="heading">{section.title}</AppText>
							<AppText variant="footnote">{section.data.length}</AppText>
						</View>
					) : null
				}
				renderSectionFooter={() => <View style={{ height: spacing.md }} />}
				ListEmptyComponent={
					exercises === undefined ? (
						<SkeletonGroup label={c.loading}>
							<SkeletonList rows={7} />
						</SkeletonGroup>
					) : (
						<EmptyState
							appearance="search"
							title={
								scope === "personal" && !search && !filterCount
									? c.noPersonal
									: c.noResults
							}
							body={
								scope === "personal" && !search && !filterCount
									? c.noPersonalBody
									: c.noResultsBody
							}
							action={{
								label:
									scope === "personal" && !search && !filterCount
										? c.add
										: c.clear,
								onPress:
									scope === "personal" && !search && !filterCount ? add : clear,
							}}
						/>
					)
				}
				renderItem={({ item, index, section }) => {
					const row = (accessibility = {}) => (
						<Pressable
							{...accessibility}
							onPress={() => open(item)}
							accessibilityRole="button"
							accessibilityLabel={`${item.name}, ${c.equipmentNames[item.equipment]}`}
							accessibilityState={{ busy: deleting === item._id }}
							disabled={deleting === item._id}
							style={({ pressed }) => [
								styles.row,
								index === 0 && styles.first,
								index === section.data.length - 1 && styles.last,
								pressed && { backgroundColor: colors.surface2 },
							]}
						>
							<MuscleIcon group={primaryGroup(item)} />
							<View style={styles.rowText}>
								<AppText variant="row">{item.name}</AppText>
								<AppText variant="footnote" style={{ color: colors.textMuted }}>
									{c.equipmentNames[item.equipment]} ·{" "}
									{item.category === "compound" ? c.compound : c.isolation}
									{!item.isDefault ? ` · ${c.personal}` : ""}
								</AppText>
							</View>
							<SymbolView
								name={{
									ios: "chevron.right",
									android: "chevron_right",
									web: "chevron_right",
								}}
								size={12}
								tintColor={colors.textFaint}
							/>
						</Pressable>
					);
					return (
						<View
							style={[
								index === 0 && styles.first,
								index === section.data.length - 1 && styles.last,
								{ overflow: "hidden" },
							]}
						>
							<SwipeableRow
								menuTitle={item.name}
								closeMenuLabel={c.cancel}
								actions={
									item.isDefault
										? [
												{
													key: "clone",
													label: c.clone,
													swipe: false,
													onPress: () =>
														router.push({
															pathname: "/exercise-new",
															params: { clone: item._id },
														}),
												},
											]
										: [
												{
													key: "edit",
													label: c.edit,
													onPress: () =>
														router.push({
															pathname: "/exercise-new",
															params: { edit: item._id, returnTo: "library" },
														}),
												},
												{
													key: "delete",
													label: c.delete,
													destructive: true,
													onPress: () => void remove(item),
												},
											]
								}
							>
								{row}
							</SwipeableRow>
						</View>
					);
				}}
			/>
			<Stack.Screen
				options={{
					title: c.title,
					headerLargeTitleEnabled: true,
					headerLargeTitleStyle: { color: colors.text },
					headerTitleStyle: { color: colors.text },
					headerTransparent: Platform.OS === "ios",
					headerShadowVisible: false,
					...(Platform.OS !== "ios"
						? {
								headerRight: () => (
									<View style={{ flexDirection: "row" }}>
										<Pressable
											accessibilityLabel={c.add}
											accessibilityRole="button"
											onPress={add}
											style={styles.filterButton}
										>
											<AppText style={{ color: colors.accent }}>＋</AppText>
										</Pressable>
										<LayoutMenu value={layout} onChange={changeLayout} />
									</View>
								),
							}
						: {}),
				}}
			/>
			{Platform.OS === "ios" ? (
				<Stack.Toolbar placement="right">
					<Stack.Toolbar.Button
						icon="plus"
						accessibilityLabel={c.add}
						onPress={add}
					/>
					<Stack.Toolbar.View>
						<LayoutMenu value={layout} onChange={changeLayout} />
					</Stack.Toolbar.View>
				</Stack.Toolbar>
			) : null}
			{draft ? (
				<FiltersSheet
					draft={draft}
					onChange={setDraft}
					count={
						filterExercises(
							exercises ?? [],
							search,
							scope === "personal",
							draft,
						).length
					}
					onCancel={() => setDraft(null)}
					onApply={() => {
						setFilters(draft);
						setDraft(null);
					}}
				/>
			) : null}
		</>
	);
}
const createStyles = (c: Tokens) =>
	StyleSheet.create({
		root: { flex: 1, backgroundColor: c.bg },
		content: {
			flexGrow: 1,
			paddingHorizontal: spacing.md,
			paddingBottom: spacing.xxl,
		},
		header: { gap: spacing.sm },
		search: {
			backgroundColor: c.surface2,
			borderRadius: radius.lg,
			borderCurve: "continuous",
		},
		summary: {
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "space-between",
		},
		filterButton: {
			minHeight: 44,
			minWidth: 44,
			flexDirection: "row",
			gap: 6,
			alignItems: "center",
			justifyContent: "center",
		},
		sectionHeader: {
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "space-between",
			paddingBottom: spacing.sm,
			paddingTop: spacing.sm,
		},
		row: {
			minHeight: 80,
			flexDirection: "row",
			alignItems: "center",
			gap: spacing.sm,
			paddingHorizontal: spacing.sm,
			paddingVertical: 12,
			backgroundColor: c.surface,
			borderBottomWidth: StyleSheet.hairlineWidth,
			borderBottomColor: c.separator,
		},
		rowText: { flex: 1, gap: 4 },
		first: { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
		last: {
			borderBottomLeftRadius: radius.lg,
			borderBottomRightRadius: radius.lg,
			borderBottomWidth: 0,
		},
	});
