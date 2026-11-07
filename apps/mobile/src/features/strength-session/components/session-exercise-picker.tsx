/** Choosing an exercise mid-session: add it, swap to it, or put it in a group. */
import type { Exercise } from "@foundry/core/exercises";
import { useMemo, useState } from "react";
import {
	FlatList,
	Modal,
	Pressable,
	StyleSheet,
	TextInput,
	View,
} from "react-native";
import { api } from "../../../convex/api";
import { useQuery } from "../../../convex/query-cache";
import {
	modalAnimation,
	useReduceMotion,
} from "../../../feedback/reduce-motion";
import { fmt, useI18n } from "../../../i18n";
import {
	radius,
	spacing,
	type Tokens,
	type,
	useThemedStyles,
	useTokens,
} from "../../../theme";
import { AppText } from "../../../ui/text";
import { formatNumber } from "../session-format";

type Line =
	| { kind: "head"; key: string; title: string }
	| { kind: "exercise"; key: string; exercise: Exercise }
	| { kind: "new"; key: string; bodyweight: boolean };
export function SessionExercisePicker({
	title,
	exercises,
	inSession,
	onPick,
	onCreate,
	onClose,
}: {
	title: string;
	exercises: readonly Exercise[] | undefined;
	inSession: readonly string[];
	onPick: (exercise: Exercise) => void;
	onCreate: (name: string, bodyweight: boolean) => void;
	onClose: () => void;
}) {
	const { locale, t } = useI18n();
	const copy = t.strength.plan.picker;
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	const reduceMotion = useReduceMotion();
	const [search, setSearch] = useState("");
	const records = useQuery(api.oneRepMaxes.listCurrentForUser, {});
	const measuredOf = useMemo(() => {
		const map = new Map<
			string,
			{ value: number; unit: string; date: number; source: string }
		>();
		for (const record of records ?? [])
			map.set(record.exerciseId as string, record);
		return map;
	}, [records]);
	const lines = useMemo((): Line[] => {
		const all = exercises ?? [];
		const term = search.trim().toLocaleLowerCase(locale);
		const row = (exercise: Exercise, prefix = ""): Line => ({
			kind: "exercise",
			key: `${prefix}${exercise._id}`,
			exercise,
		});
		if (term) {
			const hits = all.filter((exercise) =>
				exercise.name.toLocaleLowerCase(locale).includes(term),
			);
			const exact = hits.some(
				(exercise) => exercise.name.toLocaleLowerCase(locale) === term,
			);
			return [
				...hits.map((exercise) => row(exercise)),
				...(exact
					? []
					: [
							{ kind: "new", key: "new-weighted", bodyweight: false } as const,
							{ kind: "new", key: "new-bodyweight", bodyweight: true } as const,
						]),
			];
		}
		const recent = [...(records ?? [])]
			.sort((a, b) => b.date - a.date)
			.slice(0, 5)
			.flatMap((record) => {
				const exercise = all.find((item) => item._id === record.exerciseId);
				return exercise ? [exercise] : [];
			});
		return [
			...(recent.length
				? [
						{ kind: "head", key: "head-recent", title: copy.recent } as const,
						...recent.map((exercise) => row(exercise, "recent:")),
						{ kind: "head", key: "head-all", title: copy.all } as const,
					]
				: []),
			...all.map((exercise) => row(exercise)),
		];
	}, [copy.all, copy.recent, exercises, locale, records, search]);
	const typed = search.trim();
	return (
		<Modal
			visible
			presentationStyle="pageSheet"
			animationType={modalAnimation(reduceMotion, "slide")}
			onRequestClose={onClose}
		>
			<View style={styles.sheet}>
				<View style={styles.top}>
					<AppText
						variant="heading"
						accessibilityRole="header"
						style={styles.title}
					>
						{title}
					</AppText>
					<Pressable
						accessibilityRole="button"
						hitSlop={8}
						onPress={onClose}
						style={styles.closeButton}
					>
						<AppText variant="control" style={{ color: colors.accent }}>
							{copy.close}
						</AppText>
					</Pressable>
				</View>
				<TextInput
					value={search}
					onChangeText={setSearch}
					placeholder={copy.search}
					placeholderTextColor={colors.textFaint}
					style={styles.search}
					autoCorrect={false}
					returnKeyType="search"
					clearButtonMode="while-editing"
					accessibilityLabel={copy.search}
					testID="session-picker-search"
				/>
				<FlatList
					data={lines}
					keyExtractor={(line) => line.key}
					keyboardShouldPersistTaps="handled"
					keyboardDismissMode="on-drag"
					automaticallyAdjustKeyboardInsets
					ListEmptyComponent={
						<AppText variant="secondary" style={styles.empty}>
							{exercises === undefined
								? copy.loading
								: fmt(copy.noMatches, { search: typed })}
						</AppText>
					}
					renderItem={({ item }) => {
						if (item.kind === "head")
							return (
								<AppText variant="label" style={styles.head}>
									{item.title}
								</AppText>
							);
						if (item.kind === "new")
							return (
								<Pressable
									accessibilityRole="button"
									onPress={() => onCreate(typed, item.bodyweight)}
									style={styles.row}
								>
									<AppText variant="row" style={{ color: colors.accent }}>
										{fmt(
											item.bodyweight ? copy.newBodyweight : copy.newWeighted,
											{
												name: typed,
											},
										)}
									</AppText>
								</Pressable>
							);
						const record = measuredOf.get(item.exercise._id);
						const already = inSession.includes(item.exercise._id);
						const sub = record
							? fmt(record.source === "manual" ? copy.manual : copy.measured, {
									value: `${formatNumber(record.value, locale)} ${record.unit}`,
								})
							: null;
						return (
							<Pressable
								accessibilityRole="button"
								onPress={() => onPick(item.exercise)}
								style={styles.row}
							>
								<View style={styles.rowText}>
									<AppText variant="row">{item.exercise.name}</AppText>
									{sub ? (
										<AppText
											variant="caption"
											style={{ color: colors.textMuted }}
										>
											{sub}
										</AppText>
									) : null}
								</View>
								{already ? (
									<AppText
										variant="caption"
										style={{ color: colors.textMuted }}
									>
										{copy.inSession}
									</AppText>
								) : null}
							</Pressable>
						);
					}}
				/>
			</View>
		</Modal>
	);
}
const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		sheet: { flex: 1, backgroundColor: colors.bg },
		top: {
			flexDirection: "row",
			alignItems: "center",
			padding: spacing.md,
			paddingBottom: spacing.xs,
		},
		title: { flex: 1 },
		closeButton: { minHeight: 44, justifyContent: "center" },
		search: {
			marginHorizontal: spacing.md,
			marginBottom: spacing.sm,
			minHeight: 44,
			paddingHorizontal: spacing.md,
			borderRadius: radius.lg,
			backgroundColor: colors.surface2,
			color: colors.text,
			...type.body,
			fontWeight: "400",
		},
		head: {
			paddingHorizontal: spacing.md,
			paddingTop: spacing.md,
			paddingBottom: spacing.xs,
			color: colors.textMuted,
		},
		row: {
			flexDirection: "row",
			alignItems: "center",
			gap: spacing.sm,
			minHeight: 52,
			paddingHorizontal: spacing.md,
			paddingVertical: spacing.xs,
			borderBottomWidth: StyleSheet.hairlineWidth,
			borderBottomColor: colors.separator,
		},
		rowText: { flex: 1, minWidth: 0 },
		empty: { padding: spacing.md, color: colors.textMuted },
	});
