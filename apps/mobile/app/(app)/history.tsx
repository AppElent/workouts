/**
 * PROTOTYPE — #46, variant C only.
 *
 * Variant C's bet is that history does not deserve a permanent slot in the
 * chrome, so it lives one tap behind a caption on the start screen. Whether
 * that is focus or burial is exactly what the variant is asking you.
 */
import { useRouter } from "expo-router";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import {
	formatDuration,
	formatSessionDate,
	useShellData,
} from "../../src/prototype/use-shell-data";
import { colors, radius, spacing } from "../../src/theme";
import { Screen } from "../../src/ui/screen";
import { AppText } from "../../src/ui/text";

export default function History() {
	const router = useRouter();
	const { recent } = useShellData();

	return (
		<Screen>
			<View style={styles.header}>
				<Pressable onPress={() => router.back()} hitSlop={12}>
					<AppText variant="heading" style={{ color: colors.accent }}>
						‹
					</AppText>
				</Pressable>
				<AppText variant="title">History</AppText>
			</View>

			{recent === undefined ? (
				<AppText variant="caption" style={styles.status}>
					Loading…
				</AppText>
			) : recent.length === 0 ? (
				<View style={styles.empty}>
					<AppText variant="body" style={{ color: colors.textMuted }}>
						No workouts yet
					</AppText>
				</View>
			) : (
				<FlatList
					data={recent}
					keyExtractor={(item) => item._id}
					contentContainerStyle={styles.list}
					showsVerticalScrollIndicator={false}
					renderItem={({ item }) => (
						<View style={styles.row}>
							<View style={styles.flex}>
								<AppText variant="body">{item.name ?? "Free session"}</AppText>
								<AppText variant="caption">
									{formatSessionDate(item.date)}
								</AppText>
							</View>
							<AppText variant="caption">
								{formatDuration(item.startTime, item.endTime) ?? item.status}
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
	flex: { flex: 1 },
	list: {
		paddingHorizontal: spacing.md,
		paddingBottom: spacing.xxl * 2,
		gap: spacing.sm,
	},
	empty: { padding: spacing.lg, alignItems: "center" },
	row: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: colors.surface,
		borderRadius: radius.lg,
		padding: spacing.md,
	},
});
