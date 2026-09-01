/**
 * The WOD library, ported from the web's `src/routes/wods/index.tsx`.
 *
 * Same shape as the exercise library: benchmark WODs (`isDefault`) are shared
 * and read-only, the user's own can be edited and deleted. The backend enforces
 * both, so the rows simply do not offer what would fail.
 *
 * Each row shows your best score for that WOD, ranked by `bestScore` from
 * `@workouts/core` — the same function Convex uses in `wodResults.getBest`.
 * Ranking a For Time result is not "smaller is better" once time caps exist,
 * which is exactly why it is one shared function and not a comparison written
 * per screen.
 */
import { formatScore } from "@workouts/core";
import { useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
	FlatList,
	Pressable,
	ScrollView,
	StyleSheet,
	TextInput,
	View,
} from "react-native";
import { api, type Doc } from "../convex/api";
import { colors, radius, spacing } from "../theme";
import { Chip } from "../ui/coach";
import { Screen } from "../ui/screen";
import { AppText } from "../ui/text";
import { WodEditor } from "./wod-editor";

const TYPES = ["forTime", "amrap", "emom", "load"] as const;

/** Short human labels — the schema's camelCase is not for reading. */
export const WOD_TYPE_LABEL: Record<Doc<"wods">["type"], string> = {
	forTime: "For time",
	amrap: "AMRAP",
	emom: "EMOM",
	load: "Load",
};

export function WodsScreen() {
	const router = useRouter();
	const wods = useQuery(api.wods.list, {});

	const [search, setSearch] = useState("");
	const [type, setType] = useState<Doc<"wods">["type"] | null>(null);
	const [creating, setCreating] = useState(false);

	const filtered = useMemo(() => {
		const term = search.trim().toLowerCase();
		return (wods ?? []).filter((w) => {
			if (term && !w.name.toLowerCase().includes(term)) return false;
			if (type && w.type !== type) return false;
			return true;
		});
	}, [wods, search, type]);

	return (
		<Screen edges={["top", "bottom"]}>
			<View style={styles.header}>
				<Pressable
					onPress={() => router.back()}
					hitSlop={12}
					accessibilityRole="button"
					accessibilityLabel="Go back"
				>
					<AppText variant="heading" style={{ color: colors.accent }}>
						‹
					</AppText>
				</Pressable>
				<AppText variant="title" style={styles.flex}>
					WODs
				</AppText>
				<Pressable
					onPress={() => setCreating(true)}
					hitSlop={12}
					accessibilityRole="button"
					accessibilityLabel="Add WOD"
				>
					<AppText variant="heading" style={{ color: colors.accent }}>
						+
					</AppText>
				</Pressable>
			</View>

			<View style={styles.filters}>
				<TextInput
					value={search}
					onChangeText={setSearch}
					placeholder="Search WODs"
					placeholderTextColor={colors.textFaint}
					style={styles.input}
					autoCorrect={false}
				/>
				<ScrollView horizontal showsHorizontalScrollIndicator={false}>
					<View style={styles.chipRow}>
						{TYPES.map((t) => (
							<Pressable key={t} onPress={() => setType(type === t ? null : t)}>
								<Chip label={WOD_TYPE_LABEL[t]} active={type === t} />
							</Pressable>
						))}
					</View>
				</ScrollView>
			</View>

			{wods === undefined ? (
				<AppText variant="caption" style={styles.status}>
					Loading…
				</AppText>
			) : (
				<FlatList
					data={filtered}
					keyExtractor={(item) => item._id}
					contentContainerStyle={styles.list}
					showsVerticalScrollIndicator={false}
					keyboardShouldPersistTaps="handled"
					ListEmptyComponent={
						<View style={styles.empty}>
							<AppText variant="heading" style={{ color: colors.textMuted }}>
								Nothing matches
							</AppText>
							<AppText variant="caption" style={styles.centered}>
								{wods.length === 0
									? "No WODs yet — add one, or seed the benchmarks."
									: "Try clearing a filter."}
							</AppText>
						</View>
					}
					renderItem={({ item }) => <WodRow wod={item} />}
				/>
			)}

			{creating ? (
				<WodEditor visible onClose={() => setCreating(false)} />
			) : null}
		</Screen>
	);
}

function WodRow({ wod }: { wod: Doc<"wods"> }) {
	const router = useRouter();
	const best = useQuery(api.wodResults.getBest, { wodId: wod._id });

	return (
		<Pressable
			onPress={() =>
				router.push({ pathname: "/wod/[id]", params: { id: wod._id } })
			}
			style={({ pressed }) => [
				styles.row,
				pressed && { backgroundColor: colors.surface2 },
			]}
		>
			<View style={styles.flex}>
				<AppText variant="body" style={styles.name}>
					{wod.name}
				</AppText>
				<AppText variant="caption">
					{WOD_TYPE_LABEL[wod.type]}
					{wod.isDefault ? " · benchmark" : ""}
				</AppText>
			</View>
			{best ? (
				<AppText variant="body" style={styles.best}>
					{formatScore(wod.type, best)}
				</AppText>
			) : null}
			<AppText style={styles.chevron}>›</AppText>
		</Pressable>
	);
}

const styles = StyleSheet.create({
	header: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.sm,
		paddingHorizontal: spacing.md,
		paddingTop: spacing.md,
		paddingBottom: spacing.sm,
	},
	flex: { flex: 1, gap: 2 },
	filters: { paddingHorizontal: spacing.md, gap: spacing.sm },
	input: {
		minHeight: 44,
		borderRadius: radius.lg,
		paddingHorizontal: spacing.md,
		backgroundColor: colors.surface,
		borderWidth: 1,
		borderColor: colors.border,
		color: colors.text,
		fontSize: 15,
	},
	chipRow: { flexDirection: "row", gap: spacing.xs + 2 },
	status: { paddingHorizontal: spacing.md },
	list: {
		paddingHorizontal: spacing.md,
		paddingTop: spacing.sm,
		paddingBottom: spacing.xxl * 2,
		gap: spacing.sm,
	},
	row: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.sm,
		backgroundColor: colors.surface,
		borderRadius: radius.lg,
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.md,
	},
	name: { fontWeight: "700" },
	best: { fontWeight: "800", color: colors.accent },
	chevron: { fontSize: 18, color: colors.textFaint },
	empty: { alignItems: "center", gap: 4, paddingVertical: spacing.xl },
	centered: { textAlign: "center" },
});
