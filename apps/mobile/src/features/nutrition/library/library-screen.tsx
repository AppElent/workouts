import { useConvexConnectionState } from "convex/react";
import { router, Stack } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useRef, useState } from "react";
import { Modal, Platform, Pressable, ScrollView, View } from "react-native";
import type { SearchBarCommands } from "react-native-screens";
import { todayIsoDate } from "../../../data/calendar-day";
import { foodPhotos } from "../../../data/food-photo-manager";
import {
	useNutritionOperations,
	useNutritionOperationVersion,
} from "../../../data/nutrition-operation-service";
import { foodSourceKey } from "../../../data/nutrition-shortcuts";
import { usePersonalFoods } from "../../../data/personal-foods";
import { useStalledOffline } from "../../../data/stalled-offline";
import { fmt, useI18n } from "../../../i18n";
import { BarcodeScanner } from "../../../screens/barcode-scanner";
import { radius, spacing, useTokens } from "../../../theme";
import { useConfirm } from "../../../ui/confirm-dialog";
import { EmptyState } from "../../../ui/empty-state";
import { FoodVisualView } from "../../../ui/food-visual";
import { FormSearchField } from "../../../ui/form";
import { GlassSurface } from "../../../ui/glass-surface";
import { isIOS26OrLater } from "../../../ui/platform";
import type { RowAction } from "../../../ui/swipeable-row";
import { AppText } from "../../../ui/text";
import { useToast } from "../../../ui/toast";
import type { FoodRowPosition } from "../components/food-row-layout";
import { NutritionChoiceMenu } from "../components/nutrition-choice-menu";
import { NutritionListRow } from "../components/nutrition-list-row";
import { NutritionMenu } from "../components/nutrition-menu";
import { NutritionScopeChip } from "../components/nutrition-scope-chip";
import { LibrarySectionHeader } from "./components/library-section-header";
import { LibrarySelectionActions } from "./components/library-selection-actions";
import { LibraryToolbar } from "./components/library-toolbar";
import {
	combosUsing,
	filterLibrary,
	type LibraryChip,
	type LibraryItem,
	type LibraryKind,
	libraryItemName,
	libraryItems,
	librarySections,
} from "./library-items";
import { libraryCaption, libraryEnergy } from "./library-presentation";

const PREVIEW_COUNT = 4;
const CHIPS: readonly LibraryChip[] = [
	"all",
	"food",
	"recipe",
	"combo",
	"favorite",
];

function itemKey(item: LibraryItem) {
	return `${item.kind}:${item.id}`;
}

function position(index: number, count: number): FoodRowPosition {
	if (count === 1) return "only";
	if (index === 0) return "first";
	return index === count - 1 ? "last" : "middle";
}

export function LibraryScreen() {
	const { t, locale } = useI18n();
	const copy = t.nutrition.library;
	const colors = useTokens();
	const toast = useToast();
	const confirm = useConfirm();
	const library = usePersonalFoods();
	const operations = useNutritionOperations();
	useNutritionOperationVersion();
	const subject = operations.getSubject();
	const favoriteKeys = new Set(
		(subject ? operations.listFavorites(subject) : []).map(
			(shortcut) => shortcut.sourceKey,
		),
	);
	const combos = library.listCombos();
	const items = libraryItems(library.list(), combos, favoriteKeys);
	const [chip, setChip] = useState<LibraryChip>("all");
	const [query, setQuery] = useState("");
	const [selection, setSelection] = useState<Set<string> | null>(null);
	const [scanning, setScanning] = useState(false);
	const bottomToolbar = isIOS26OrLater();
	const searchRef = useRef<SearchBarCommands>(null);
	const connected = useConvexConnectionState().isWebSocketConnected;
	const offline = useStalledOffline(true, connected);
	const visible = filterLibrary(items, { chip, query, locale });
	const searching = query.trim().length > 0;
	const selecting = selection !== null;

	const problems = [
		...library.backup.conflicts.map((conflict) => ({
			key: `conflict:${conflict.record.kind}:${conflict.record.id}`,
			name:
				conflict.record.kind === "food"
					? (library.find(conflict.record.id)?.name[locale] ?? copy.conflict)
					: (library.findCombo(conflict.record.id)?.name ?? copy.conflict),
		})),
		...combos
			.filter((combo) => combo.parts.some((part) => part.status === "missing"))
			.map((combo) => ({ key: `combo:${combo.id}`, name: combo.name })),
	];

	const open = (item: LibraryItem) => {
		if (item.kind === "combo")
			router.push({
				pathname: "/nutrition-combo/[id]",
				params: { id: item.id },
			});
		else
			router.push({
				pathname: "/personal-food/[id]",
				params: { id: item.id },
			});
	};
	const createNew = (classification: "ordinary" | "recipe", name?: string) =>
		router.push({
			pathname: "/personal-food-new",
			params: { classification, ...(name ? { name } : {}) },
		});
	const startSelection = (kind?: LibraryKind) => {
		setSelection(new Set());
		if (kind) setChip(kind === "combo" ? "all" : kind);
	};
	// Foods and recipes can both be parts, so the selection shows every kind.
	const newCombo = () => startSelection("combo");

	const toggleFavorite = (item: LibraryItem) => {
		if (!subject || item.kind === "combo") return;
		operations.toggleFavorite(
			subject,
			foodSourceKey("personal", item.id),
			!item.favorite,
		);
	};
	const duplicate = (item: LibraryItem) => {
		try {
			if (item.kind === "combo") {
				const { id: _id, createdAt: _c, updatedAt: _u, ...draft } = item.combo;
				library.createCombo({
					...draft,
					name: `${draft.name}${copy.copySuffix}`,
					parts: draft.parts.map(({ id: _part, status: _s, ...part }) => part),
				});
			} else {
				const { id: _id, createdAt: _c, updatedAt: _u, ...draft } = item.food;
				library.create({
					...draft,
					name: {
						en: `${draft.name.en}${copy.copySuffix}`,
						nl: `${draft.name.nl}${copy.copySuffix}`,
					},
				});
			}
			toast.success(
				fmt(copy.duplicated, { name: libraryItemName(item, locale) }),
			);
		} catch {
			toast.error(copy.actionFailure);
		}
	};
	const remove = async (targets: readonly LibraryItem[]) => {
		if (targets.length === 0) return;
		const users = [
			...new Set(
				targets.flatMap((item) =>
					item.kind === "combo"
						? []
						: combosUsing(item.id, combos)
								.filter(
									(combo) =>
										!targets.some(
											(target) =>
												target.kind === "combo" && target.id === combo.id,
										),
								)
								.map((combo) => `‘${combo.name}’`),
				),
			),
		];
		const ok = await confirm({
			title:
				targets.length === 1
					? fmt(copy.deleteOneTitle, {
							name: libraryItemName(targets[0], locale),
						})
					: fmt(copy.deleteManyTitle, { count: targets.length }),
			message: [
				users.length ? fmt(copy.usedIn, { combos: users.join(", ") }) : "",
				copy.diaryUnchanged,
			]
				.filter(Boolean)
				.join(" "),
			confirmLabel: copy.delete,
			cancelLabel: t.diaryEntry.cancel,
			destructive: true,
		});
		if (!ok) return;
		try {
			for (const item of targets) {
				if (item.kind === "combo") library.removeCombo(item.id);
				else if (library.remove(item.id)) foodPhotos.remove(item.food.visual);
			}
			setSelection(null);
			toast.success(
				targets.length === 1
					? fmt(copy.deleted, { name: libraryItemName(targets[0], locale) })
					: fmt(copy.deletedMany, { count: targets.length }),
			);
		} catch {
			toast.error(copy.actionFailure);
		}
	};
	const actions = (item: LibraryItem): RowAction[] =>
		item.kind === "combo"
			? [
					{
						key: "log",
						label: copy.log,
						systemImage: "plus",
						swipe: false,
						onPress: () =>
							router.push({
								pathname: "/nutrition-combos",
								params: { comboId: item.id, date: todayIsoDate() },
							}),
					},
					{
						key: "edit",
						label: copy.edit,
						systemImage: "square.and.pencil",
						onPress: () => open(item),
					},
					{
						key: "duplicate",
						label: copy.duplicate,
						systemImage: "plus.square.on.square",
						swipe: false,
						dividerAfter: true,
						onPress: () => duplicate(item),
					},
					{
						key: "delete",
						label: copy.delete,
						systemImage: "trash",
						destructive: true,
						onPress: () => void remove([item]),
					},
				]
			: [
					{
						key: "edit",
						label: copy.edit,
						systemImage: "square.and.pencil",
						onPress: () => open(item),
					},
					{
						key: "favorite",
						label: item.favorite ? copy.unfavorite : copy.favorite,
						systemImage: item.favorite ? "star.fill" : "star",
						swipe: false,
						onPress: () => toggleFavorite(item),
					},
					{
						key: "duplicate",
						label: copy.duplicate,
						systemImage: "plus.square.on.square",
						swipe: false,
						dividerAfter: true,
						onPress: () => duplicate(item),
					},
					{
						key: "delete",
						label: copy.delete,
						systemImage: "trash",
						destructive: true,
						onPress: () => void remove([item]),
					},
				];

	const selectedItems = selection
		? items.filter((item) => selection.has(itemKey(item)))
		: [];
	const toggle = (item: LibraryItem) =>
		setSelection((current) => {
			const next = new Set(current);
			if (next.has(itemKey(item))) next.delete(itemKey(item));
			else next.add(itemKey(item));
			return next;
		});

	const row = (item: LibraryItem, index: number, count: number) => {
		const energy = libraryEnergy(item, locale, copy);
		const name = libraryItemName(item, locale);
		return (
			<NutritionListRow
				key={itemKey(item)}
				title={item.favorite ? `${name} ★` : name}
				caption={libraryCaption(item, locale, copy)}
				value={energy.value}
				basis={energy.basis}
				leading={
					item.kind === "combo" ? (
						<View
							style={{
								width: 38,
								height: 38,
								borderRadius: radius.lg,
								backgroundColor: colors.surface2,
								alignItems: "center",
								justifyContent: "center",
							}}
						>
							<SymbolView
								name={{
									ios: "square.stack.3d.up",
									android: "layers",
									web: "layers",
								}}
								size={17}
								tintColor={colors.text}
							/>
						</View>
					) : (
						<FoodVisualView visual={item.food.visual} label={name} size={38} />
					)
				}
				position={position(index, count)}
				selected={
					selecting ? (selection?.has(itemKey(item)) ?? false) : undefined
				}
				selectLabel={copy.select}
				actions={actions(item)}
				closeMenuLabel={t.diaryEntry.cancel}
				onPress={() => (selecting ? toggle(item) : open(item))}
			/>
		);
	};

	const sectionMenu = (kind: LibraryKind) =>
		kind === "combo"
			? [
					{ id: "new", label: copy.newCombo },
					{ id: "select", label: copy.select },
				]
			: [
					{
						id: "new",
						label: kind === "food" ? copy.newFood : copy.newRecipe,
					},
					{ id: "select", label: copy.select },
				];

	const addMenu = {
		label: copy.add,
		newFoodLabel: copy.newFood,
		newRecipeLabel: copy.newRecipe,
		newComboLabel: copy.newCombo,
		onNewFood: () => createNew("ordinary"),
		onNewRecipe: () => createNew("recipe"),
		onNewCombo: newCombo,
	};
	const moreMenu = (
		<NutritionChoiceMenu
			accessibilityLabel={copy.more}
			sections={[
				[{ id: "select", label: copy.select }],
				[
					{ id: "measures", label: copy.measures },
					{ id: "backup", label: copy.backup },
					{ id: "settings", label: copy.settings },
				],
			]}
			onSelect={(id) => {
				if (id === "select") startSelection();
				else if (id === "measures") router.push("/personal-measures");
				else router.push("/nutrition-settings");
			}}
			style={{ width: 44, height: 44 }}
		>
			<View
				style={{
					width: 44,
					height: 44,
					alignItems: "center",
					justifyContent: "center",
				}}
			>
				<SymbolView
					name={{ ios: "ellipsis", android: "more_horiz", web: "more_horiz" }}
					size={20}
					tintColor={colors.text}
				/>
			</View>
		</NutritionChoiceMenu>
	);
	const doneButton = (
		<Pressable
			accessibilityRole="button"
			onPress={() => setSelection(null)}
			style={{
				minHeight: 40,
				paddingHorizontal: spacing.md,
				borderRadius: radius.pill,
				backgroundColor: colors.accentFill,
				justifyContent: "center",
			}}
		>
			<AppText
				variant="footnote"
				style={{ color: colors.onAccent, fontWeight: "700" }}
			>
				{copy.done}
			</AppText>
		</Pressable>
	);
	const selectionActions = [
		{
			key: "combo",
			label: copy.makeCombo,
			icon: "square.stack.3d.up" as const,
			disabled:
				selectedItems.filter((item) => item.kind !== "combo").length < 2,
			onPress: () =>
				router.push({
					pathname: "/nutrition-combo-new",
					params: {
						foodIds: selectedItems
							.filter((item) => item.kind !== "combo")
							.map((item) => item.id)
							.join(","),
					},
				}),
		},
		{
			key: "favorite",
			label: copy.favorite,
			icon: "star" as const,
			disabled: !selectedItems.some((item) => item.kind !== "combo"),
			onPress: () => {
				if (!subject) return;
				const allFavorite = selectedItems
					.filter((item) => item.kind !== "combo")
					.every((item) => item.favorite);
				for (const item of selectedItems)
					if (item.kind !== "combo")
						operations.toggleFavorite(
							subject,
							foodSourceKey("personal", item.id),
							!allFavorite,
						);
			},
		},
		{
			key: "duplicate",
			label: copy.duplicate,
			icon: "plus.square.on.square" as const,
			disabled: selectedItems.length === 0,
			onPress: () => {
				for (const item of selectedItems) duplicate(item);
				setSelection(null);
			},
		},
		{
			key: "delete",
			label: copy.delete,
			icon: "trash" as const,
			destructive: true,
			disabled: selectedItems.length === 0,
			onPress: () => void remove(selectedItems),
		},
	];

	const firstTime = items.length === 0;
	const sections = librarySections(visible);
	const statusLine = library.backup.restoreError ? (
		<StatusRow
			icon="exclamationmark.triangle"
			title={copy.restoreFailed}
			action={copy.retry}
			onPress={library.backup.restore}
		/>
	) : problems.length ? (
		<StatusRow
			icon="exclamationmark.triangle"
			title={copy.attention}
			detail={problems.map((problem) => problem.name).join(" · ")}
			onPress={() => router.push("/nutrition-library-attention")}
		/>
	) : offline ? (
		<StatusRow icon="icloud.slash" title={copy.offline} />
	) : null;

	if (scanning)
		return (
			<Modal visible presentationStyle="fullScreen" animationType="slide">
				<BarcodeScanner
					onCancel={() => setScanning(false)}
					onScanned={(barcode) => {
						setScanning(false);
						const local = library.findByBarcode(barcode);
						if (local)
							router.push({
								pathname: "/personal-food/[id]",
								params: { id: local.id },
							});
						else
							router.push({
								pathname: "/personal-food-new",
								params: { barcode },
							});
					}}
				/>
			</Modal>
		);

	return (
		<>
			<Stack.Screen
				options={{
					title: selecting
						? fmt(copy.selected, { count: selectedItems.length })
						: copy.title,
					headerLargeTitleEnabled: true,
					headerLargeTitleStyle: { color: colors.text },
					headerTitleStyle: { color: colors.text },
					headerBackVisible: !selecting,
					headerRight: () =>
						Platform.OS === "ios" ? null : selecting ? doneButton : moreMenu,
				}}
			/>
			{Platform.OS === "ios" ? (
				<Stack.Toolbar placement="right">
					<Stack.Toolbar.View hidesSharedBackground>
						{selecting ? (
							doneButton
						) : (
							<GlassSurface capsule>{moreMenu}</GlassSurface>
						)}
					</Stack.Toolbar.View>
				</Stack.Toolbar>
			) : null}
			{bottomToolbar && !selecting ? (
				<LibraryToolbar
					searchRef={searchRef}
					placeholder={copy.searchPlaceholder}
					scanLabel={copy.scan}
					menu={addMenu}
					onChangeQuery={setQuery}
					onScan={() => setScanning(true)}
				/>
			) : null}
			{selecting && Platform.OS === "ios" ? (
				<Stack.Toolbar placement="bottom">
					<Stack.Toolbar.View>
						<LibrarySelectionActions actions={selectionActions} />
					</Stack.Toolbar.View>
				</Stack.Toolbar>
			) : null}
			<ScrollView
				style={{ flex: 1, backgroundColor: colors.bg }}
				contentInsetAdjustmentBehavior="automatic"
				keyboardShouldPersistTaps="handled"
				contentContainerStyle={{ paddingBottom: spacing.xxl * 2, gap: 0 }}
			>
				<AppText
					variant="footnote"
					style={{
						marginHorizontal: 20,
						marginTop: -spacing.xs,
						display: searching ? "none" : "flex",
					}}
				>
					{selecting
						? copy.title
						: items.length === 1
							? copy.itemCountOne
							: fmt(copy.itemCount, { count: items.length })}
				</AppText>
				{bottomToolbar || selecting ? null : (
					<View
						style={{
							flexDirection: "row",
							alignItems: "center",
							gap: spacing.sm,
							marginHorizontal: spacing.md,
							marginTop: spacing.sm,
						}}
					>
						<View
							style={{
								flex: 1,
								backgroundColor: colors.surface,
								borderRadius: radius.pill,
							}}
						>
							<FormSearchField
								label={copy.searchPlaceholder}
								placeholder={copy.searchPlaceholder}
								value={query}
								onChangeText={setQuery}
							/>
						</View>
						<NutritionMenu
							label={copy.add}
							closeLabel={t.diaryEntry.cancel}
							actions={[
								{ label: copy.newFood, onPress: addMenu.onNewFood },
								{ label: copy.newRecipe, onPress: addMenu.onNewRecipe },
								{ label: copy.newCombo, onPress: addMenu.onNewCombo },
							]}
							trigger={{
								content: <AppText variant="heading">+</AppText>,
							}}
						/>
						<Pressable
							accessibilityRole="button"
							accessibilityLabel={copy.scan}
							onPress={() => setScanning(true)}
							style={{
								minWidth: 44,
								minHeight: 44,
								alignItems: "center",
								justifyContent: "center",
							}}
						>
							<SymbolView
								name={{
									ios: "barcode.viewfinder",
									android: "qr_code_scanner",
									web: "qr_code_scanner",
								}}
								size={20}
								tintColor={colors.text}
							/>
						</Pressable>
					</View>
				)}
				{firstTime && !searching ? (
					<View
						style={{
							margin: spacing.md,
							backgroundColor: colors.surface,
							borderRadius: radius.contentCard,
							paddingTop: spacing.md,
						}}
					>
						<View style={{ paddingHorizontal: spacing.md }}>
							<EmptyState title={copy.firstTitle} body={copy.firstBody} />
						</View>
						<View
							style={{ padding: spacing.md, paddingTop: 0, gap: spacing.sm }}
						>
							{[
								{ label: copy.firstScan, onPress: () => setScanning(true) },
								{ label: copy.firstNew, onPress: () => createNew("ordinary") },
								{
									label: copy.firstOff,
									onPress: () => router.push("/nutrition-food"),
								},
							].map((action) => (
								<Pressable
									key={action.label}
									accessibilityRole="button"
									onPress={action.onPress}
									style={({ pressed }) => ({
										minHeight: 48,
										borderRadius: radius.pill,
										backgroundColor: pressed
											? colors.borderStrong
											: colors.surface2,
										alignItems: "center",
										justifyContent: "center",
									})}
								>
									<AppText style={{ fontWeight: "700", color: colors.text }}>
										{action.label}
									</AppText>
								</Pressable>
							))}
						</View>
					</View>
				) : (
					<>
						{searching || selecting ? null : (
							<ScrollView
								horizontal
								showsHorizontalScrollIndicator={false}
								accessibilityRole="tablist"
								contentContainerStyle={{
									gap: spacing.sm,
									paddingHorizontal: spacing.md,
									paddingVertical: spacing.sm,
								}}
							>
								{CHIPS.map((value) => (
									<NutritionScopeChip
										key={value}
										label={copy.chips[value]}
										selected={chip === value}
										onPress={() => setChip(value)}
									/>
								))}
							</ScrollView>
						)}
						{!searching && !selecting && statusLine ? (
							<View
								style={{ marginHorizontal: spacing.md, marginTop: spacing.xs }}
							>
								{statusLine}
							</View>
						) : null}
						{chip === "favorite" && !searching ? (
							visible.length === 0 ? (
								<AppText variant="secondary" style={{ margin: 20 }}>
									{copy.emptyChip}
								</AppText>
							) : (
								<View style={{ marginTop: spacing.sm }}>
									{visible.map((item, index) =>
										row(item, index, visible.length),
									)}
								</View>
							)
						) : (
							sections
								.filter(
									(section) =>
										(chip === "all" || chip === section.kind) &&
										(!searching || section.items.length > 0),
								)
								.map((section) => {
									const total = section.items.length;
									const shown =
										chip === "all" && !searching && !selecting
											? section.items.slice(0, PREVIEW_COUNT)
											: section.items;
									const sectionKeys = section.items.map(itemKey);
									return (
										<View key={section.kind}>
											<LibrarySectionHeader
												title={copy.sections[section.kind]}
												count={total}
												menuLabel={copy.sections[section.kind]}
												actions={
													total === 0 || searching
														? undefined
														: sectionMenu(section.kind)
												}
												onSelect={(id) => {
													if (id === "select") startSelection(section.kind);
													else if (section.kind === "combo") newCombo();
													else
														createNew(
															section.kind === "recipe" ? "recipe" : "ordinary",
														);
												}}
												allLabel={copy.all}
												onToggleAll={
													selecting && total
														? () =>
																setSelection((current) => {
																	const next = new Set(current);
																	const all = sectionKeys.every((key) =>
																		next.has(key),
																	);
																	for (const key of sectionKeys)
																		if (all) next.delete(key);
																		else next.add(key);
																	return next;
																})
														: undefined
												}
											/>
											{total === 0 ? (
												<AppText
													variant="footnote"
													style={{ marginHorizontal: 20 }}
												>
													{copy.emptySection[section.kind]}
												</AppText>
											) : (
												<>
													{shown.map((item, index) =>
														row(
															item,
															index,
															shown.length + (shown.length < total ? 1 : 0),
														),
													)}
													{shown.length < total ? (
														<Pressable
															accessibilityRole="button"
															onPress={() => setChip(section.kind)}
															style={({ pressed }) => ({
																marginHorizontal: spacing.md,
																minHeight: 48,
																alignItems: "center",
																justifyContent: "center",
																backgroundColor: pressed
																	? colors.surface2
																	: colors.surface,
																borderBottomLeftRadius: radius.contentCard,
																borderBottomRightRadius: radius.contentCard,
																borderTopWidth: 0.5,
																borderTopColor: colors.separator,
															})}
														>
															<AppText
																variant="footnote"
																style={{
																	color: colors.accent,
																	fontWeight: "700",
																}}
															>
																{fmt(copy.showAll[section.kind], {
																	count: total,
																})}
															</AppText>
														</Pressable>
													) : null}
												</>
											)}
										</View>
									);
								})
						)}
						{searching ? (
							<View
								style={{
									margin: spacing.md,
									gap: spacing.sm,
									alignItems: "center",
								}}
							>
								{visible.length === 0 ? (
									<>
										<AppText variant="heading" style={{ textAlign: "center" }}>
											{fmt(copy.noResults, { query: query.trim() })}
										</AppText>
										{(["ordinary", "recipe"] as const).map((classification) => (
											<Pressable
												key={classification}
												accessibilityRole="button"
												onPress={() => createNew(classification, query.trim())}
												style={{
													minHeight: 44,
													paddingHorizontal: spacing.md,
													borderRadius: radius.pill,
													backgroundColor: colors.surface,
													justifyContent: "center",
												}}
											>
												<AppText
													style={{ color: colors.accent, fontWeight: "700" }}
												>
													{fmt(
														classification === "recipe"
															? copy.createRecipe
															: copy.createFood,
														{ query: query.trim() },
													)}
												</AppText>
											</Pressable>
										))}
									</>
								) : (
									<AppText variant="caption" style={{ textAlign: "center" }}>
										{copy.searchedNote}
									</AppText>
								)}
								<Pressable
									accessibilityRole="link"
									onPress={() =>
										router.push({
											pathname: "/nutrition-food",
											params: { query: query.trim() },
										})
									}
									style={{ minHeight: 44, justifyContent: "center" }}
								>
									<AppText
										variant="footnote"
										style={{ color: colors.accent, fontWeight: "700" }}
									>
										{fmt(copy.offLink, { query: query.trim() })}
									</AppText>
								</Pressable>
							</View>
						) : null}
					</>
				)}
			</ScrollView>
			{selecting && Platform.OS !== "ios" ? (
				<View style={{ alignItems: "center", backgroundColor: colors.surface }}>
					<LibrarySelectionActions actions={selectionActions} />
				</View>
			) : null}
		</>
	);
}

function StatusRow({
	icon,
	title,
	detail,
	action,
	onPress,
}: {
	icon: "exclamationmark.triangle" | "icloud.slash";
	title: string;
	detail?: string;
	action?: string;
	onPress?: () => void;
}) {
	const colors = useTokens();
	return (
		<Pressable
			accessibilityRole={onPress ? "button" : undefined}
			disabled={!onPress}
			onPress={onPress}
			style={({ pressed }) => ({
				minHeight: 56,
				flexDirection: "row",
				alignItems: "center",
				gap: 12,
				paddingHorizontal: spacing.md,
				paddingVertical: 10,
				borderRadius: radius.contentCard,
				backgroundColor: pressed ? colors.surface2 : colors.surface,
			})}
		>
			<View
				style={{
					width: 30,
					height: 30,
					borderRadius: radius.md,
					backgroundColor: colors.warnSoft,
					alignItems: "center",
					justifyContent: "center",
				}}
			>
				<SymbolView name={icon} size={15} tintColor={colors.warn} />
			</View>
			<View style={{ flex: 1 }}>
				<AppText variant="secondary" style={{ color: colors.text }}>
					{title}
				</AppText>
				{detail ? (
					<AppText variant="caption" numberOfLines={1}>
						{detail}
					</AppText>
				) : null}
			</View>
			{action ? (
				<AppText
					variant="footnote"
					style={{ color: colors.accent, fontWeight: "700" }}
				>
					{action}
				</AppText>
			) : onPress ? (
				<SymbolView
					name={{
						ios: "chevron.right",
						android: "chevron_right",
						web: "chevron_right",
					}}
					size={13}
					weight="semibold"
					tintColor={colors.textFaint}
				/>
			) : null}
		</Pressable>
	);
}
