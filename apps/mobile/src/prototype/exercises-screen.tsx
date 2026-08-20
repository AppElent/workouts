/**
 * The exercise library — the one destination besides the session that has real
 * content in V1, so it is the only screen that can honestly answer "does this
 * app have somewhere to go?".
 *
 * Read-only. Creating exercises is not in the V1 scope on #41; the list exists
 * here because a tab (or a pushed screen) with nothing in it proves nothing
 * about the shell.
 *
 * Lives in `src/` rather than as a route because two route files mount it: a
 * pushed screen in variants A and C, a tab root in variant B. `showBack`
 * carries that difference — a tab root has nothing to go back to.
 */
import { useRouter } from "expo-router";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import type { Doc } from "../convex/api";
import { colors, radius, spacing } from "../theme";
import { Screen } from "../ui/screen";
import { AppText } from "../ui/text";
import { useShellData } from "./use-shell-data";

export function ExercisesScreen({ showBack }: { showBack: boolean }) {
	const router = useRouter();
	const { exercises } = useShellData();

	return (
		<Screen edges={showBack ? ["top", "bottom"] : ["top"]}>
			<View style={styles.header}>
				{showBack ? (
					<Pressable onPress={() => router.back()} hitSlop={12}>
						<AppText variant="heading" style={{ color: colors.accent }}>
							‹
						</AppText>
					</Pressable>
				) : null}
				<AppText variant="title">Exercises</AppText>
			</View>

			{exercises === undefined ? (
				<AppText variant="caption" style={styles.status}>
					Loading…
				</AppText>
			) : (
				<FlatList
					data={exercises}
					keyExtractor={(item) => item._id}
					contentContainerStyle={styles.list}
					showsVerticalScrollIndicator={false}
					renderItem={({ item }: { item: Doc<"exercises"> }) => (
						<View style={styles.row}>
							<AppText variant="body">{item.name}</AppText>
							<AppText variant="caption" style={styles.meta}>
								{item.category} · {item.equipment}
							</AppText>
						</View>
					)}
				/>
			)}
		</Screen>
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
	status: { paddingHorizontal: spacing.md },
	list: {
		paddingHorizontal: spacing.md,
		paddingBottom: spacing.xxl * 2,
		gap: spacing.sm,
	},
	row: {
		backgroundColor: colors.surface,
		borderRadius: radius.lg,
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.md,
	},
	meta: { marginTop: 2, textTransform: "capitalize" },
});
