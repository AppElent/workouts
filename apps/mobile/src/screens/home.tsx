/**
 * Home tab. Laid out from `designs/shell/index.html#home`.
 *
 * Active and recent sessions are real; the weekly ring counts real sessions in
 * the last seven days. Strength is the only activity type with a backend, so
 * the sport quick-links and the "Up next" card are still shape rather than
 * substance — per ADR-0002 every one of them lands on the same Start Activity
 * picker, which is where the type actually gets chosen.
 */
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import {
	formatDuration,
	formatSessionDate,
	useShellData,
} from "../data/session-data";
import { colors, sportMeta } from "../theme";
import { Card, Eyebrow, SportIcon } from "../ui/coach";
import { AppText } from "../ui/text";

const DAY_MS = 24 * 60 * 60 * 1000;

export function HomeScreen() {
	const router = useRouter();
	const { active, recent, loading } = useShellData();

	const weekCount =
		recent?.filter((s) => Date.now() - s.date < 7 * DAY_MS).length ?? 0;

	const today = new Date().toLocaleDateString(undefined, {
		weekday: "long",
		day: "numeric",
		month: "short",
	});

	return (
		<ScrollView
			contentInsetAdjustmentBehavior="automatic"
			automaticallyAdjustKeyboardInsets
			keyboardDismissMode="interactive"
			style={styles.root}
			contentContainerStyle={styles.content}
			showsVerticalScrollIndicator={false}
		>
			<View style={styles.between}>
				<View>
					<AppText style={styles.eyebrowDate}>{today}</AppText>
					<AppText style={styles.h1}>Ready to move</AppText>
				</View>
				<View style={styles.avatar}>
					<AppText style={styles.avatarText}>EJ</AppText>
				</View>
			</View>

			<Card style={styles.weekCard}>
				<View style={styles.ring}>
					<AppText style={styles.ringValue}>{weekCount}</AppText>
					<AppText style={styles.ringLabel}>this wk</AppText>
				</View>
				<View style={styles.flex}>
					<AppText style={styles.h2}>This week</AppText>
					<AppText style={styles.muted}>
						{weekCount === 0
							? "No sessions logged yet"
							: `${weekCount} session${weekCount === 1 ? "" : "s"} logged`}
					</AppText>
				</View>
			</Card>

			{active ? (
				<Card style={styles.activeCard}>
					<View style={styles.row}>
						<View style={styles.dot} />
						<AppText style={styles.inProgress}>In progress</AppText>
					</View>
					<AppText style={styles.h1}>{active.name ?? "Free session"}</AppText>
					<Pressable
						onPress={() =>
							router.push({
								pathname: "/session",
								params: { id: active._id },
							})
						}
						style={styles.resumeBtn}
					>
						<AppText style={styles.resumeBtnText}>Resume</AppText>
					</Pressable>
				</Card>
			) : (
				<Card style={styles.upNext}>
					<View style={styles.between}>
						<Eyebrow>Up next</Eyebrow>
						<AppText style={styles.change}>Change</AppText>
					</View>
					<AppText style={styles.h2}>Easy Run · 5K</AppText>
					<AppText style={styles.muted}>Zone 2 · nice and easy</AppText>
					<Pressable
						onPress={() => router.push("/start-activity")}
						style={styles.startBtn}
					>
						<AppText style={styles.startBtnText}>Start activity</AppText>
					</Pressable>
				</Card>
			)}

			<View style={styles.sportRow}>
				{(Object.keys(sportMeta) as (keyof typeof sportMeta)[]).map((key) => (
					<Pressable
						key={key}
						onPress={() => router.push("/start-activity")}
						style={[styles.sportTile, { backgroundColor: sportMeta[key].dim }]}
					>
						<SportIcon sport={key} size={24} />
						<AppText style={styles.sportLabel}>{sportMeta[key].label}</AppText>
					</Pressable>
				))}
			</View>

			<View style={styles.between}>
				<Eyebrow>Recent</Eyebrow>
				<AppText style={styles.change}>See all</AppText>
			</View>

			{loading ? (
				<AppText style={styles.muted}>Loading…</AppText>
			) : recent && recent.length > 0 ? (
				<View style={styles.list}>
					{recent.slice(0, 4).map((item) => (
						<Pressable
							key={item._id}
							onPress={() =>
								router.push({
									pathname: "/summary",
									params: { id: item._id },
								})
							}
							style={styles.recentRow}
						>
							<SportIcon sport="strength" size={40} />
							<View style={styles.flex}>
								<AppText style={styles.rowTitle}>
									{item.name ?? "Free session"}
								</AppText>
								<AppText style={styles.rowSub}>
									{formatSessionDate(item.date)}
								</AppText>
							</View>
							<AppText style={styles.rowTime}>
								{formatDuration(item.startTime, item.endTime) ?? item.status}
							</AppText>
						</Pressable>
					))}
				</View>
			) : (
				<AppText style={styles.muted}>
					No sessions yet — start one above.
				</AppText>
			)}
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1, backgroundColor: colors.bg },
	content: { padding: 20, paddingTop: 12, gap: 16, paddingBottom: 24 },
	between: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
	row: { flexDirection: "row", alignItems: "center", gap: 8 },
	flex: { flex: 1, gap: 2 },
	eyebrowDate: {
		fontSize: 12,
		fontWeight: "700",
		letterSpacing: 1,
		textTransform: "uppercase",
		color: colors.textMuted,
	},
	h1: {
		fontSize: 26,
		fontWeight: "800",
		color: colors.text,
		letterSpacing: -0.5,
	},
	h2: { fontSize: 18, fontWeight: "800", color: colors.text },
	muted: { fontSize: 13, color: colors.textMuted },
	avatar: {
		width: 44,
		height: 44,
		borderRadius: 9999,
		backgroundColor: colors.surface2,
		borderWidth: 1,
		borderColor: colors.borderStrong,
		alignItems: "center",
		justifyContent: "center",
	},
	avatarText: { fontSize: 13, fontWeight: "700", color: colors.textMuted },
	weekCard: { flexDirection: "row", alignItems: "center", gap: 16 },
	ring: {
		width: 64,
		height: 64,
		borderRadius: 9999,
		borderWidth: 6,
		borderColor: colors.accent,
		alignItems: "center",
		justifyContent: "center",
	},
	ringValue: { fontSize: 18, fontWeight: "800", color: colors.text },
	ringLabel: { fontSize: 9, color: colors.textMuted },
	activeCard: {
		gap: 10,
		backgroundColor: colors.accentDim,
		borderColor: colors.accent,
	},
	dot: {
		width: 8,
		height: 8,
		borderRadius: 9999,
		backgroundColor: colors.accent,
	},
	inProgress: {
		fontSize: 12,
		fontWeight: "700",
		letterSpacing: 1,
		textTransform: "uppercase",
		color: colors.accent,
	},
	upNext: { gap: 10 },
	change: { fontSize: 12, fontWeight: "700", color: colors.accent },
	sportRow: { flexDirection: "row", gap: 8 },
	sportTile: {
		flex: 1,
		alignItems: "center",
		gap: 6,
		paddingVertical: 12,
		borderRadius: 14,
	},
	sportLabel: { fontSize: 10, fontWeight: "700", color: colors.textMuted },
	list: { gap: 8 },
	recentRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
		backgroundColor: colors.surface,
		borderRadius: 14,
		padding: 12,
	},
	rowTitle: { fontSize: 14, fontWeight: "700", color: colors.text },
	rowSub: { fontSize: 11, color: colors.textMuted },
	rowTime: { fontSize: 12, fontWeight: "700", color: colors.textMuted },
	resumeBtn: {
		height: 44,
		borderRadius: 9999,
		backgroundColor: colors.accent,
		alignItems: "center",
		justifyContent: "center",
	},
	resumeBtnText: {
		fontSize: 14,
		fontWeight: "800",
		color: colors.onAccent,
	},
	startBtn: {
		height: 48,
		borderRadius: 9999,
		backgroundColor: colors.accent,
		alignItems: "center",
		justifyContent: "center",
	},
	startBtnText: {
		fontSize: 15,
		fontWeight: "800",
		color: colors.onAccent,
	},
});
