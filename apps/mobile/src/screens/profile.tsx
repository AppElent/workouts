/**
 * Profile tab. Laid out from `designs/shell/index.html#profile`.
 *
 * Sign-out is real. Lifetime totals are still static, and so are the first
 * three preference rows: neither a distance unit nor a cross-sport rollup
 * exists in the schema yet.
 *
 * Language is the exception and the reason this file changed in #69 — it is a
 * real setting with a real pushed screen. It lives here rather than on the
 * sign-in screen because a signed-out person has stated no preference and the
 * device decides for them.
 *
 * Note this is not a port of the web's `/profile` — that route only redirects
 * to `@appelent/auth`'s account panel. The phone keeps its own screen.
 */
import { useAuth } from "@clerk/expo";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useI18n } from "../i18n";
import { colors } from "../theme";
import { Eyebrow, StatBox } from "../ui/coach";
import { AppText } from "../ui/text";

export function ProfileScreen() {
	const { signOut } = useAuth();
	const router = useRouter();
	const { t, locale } = useI18n();

	return (
		<ScrollView
			style={styles.root}
			contentContainerStyle={styles.content}
			contentInsetAdjustmentBehavior="automatic"
		>
			<View style={styles.header}>
				<View style={styles.avatar}>
					<AppText style={styles.avatarText}>EJ</AppText>
				</View>
				<AppText style={styles.name}>Eric Jansen</AppText>
				<AppText style={styles.muted}>Member since Mar 2025</AppText>
			</View>

			<View style={styles.statRow}>
				<StatBox value="142" label="Sessions" />
				<StatBox value="312 km" label="Distance" />
				<StatBox value="18" label="PRs" />
			</View>

			<Eyebrow>{t.preferences.heading}</Eyebrow>
			<View style={styles.group}>
				<View style={styles.groupRow}>
					<AppText style={styles.label}>{t.preferences.units}</AppText>
					<AppText style={[styles.value, { color: colors.accent }]}>
						kg · km
					</AppText>
				</View>
				<View style={[styles.groupRow, styles.divider]}>
					<AppText style={styles.label}>{t.preferences.notifications}</AppText>
					<AppText style={styles.muted}>On</AppText>
				</View>
				<View style={[styles.groupRow, styles.divider]}>
					<AppText style={styles.label}>{t.preferences.connectedApps}</AppText>
					<AppText style={styles.muted}>None</AppText>
				</View>
				<Pressable
					onPress={() => router.push("/language")}
					accessibilityRole="button"
					style={({ pressed }) => [
						styles.groupRow,
						styles.divider,
						pressed ? { backgroundColor: colors.surface2 } : null,
					]}
				>
					<AppText style={styles.label}>{t.preferences.language}</AppText>
					<AppText style={[styles.value, { color: colors.accent }]}>
						{t.language.names[locale]} ›
					</AppText>
				</Pressable>
			</View>

			<Pressable onPress={() => signOut()} style={styles.signOutBtn}>
				<AppText style={styles.signOutText}>Sign out</AppText>
			</Pressable>
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1, backgroundColor: colors.bg },
	content: { padding: 20, paddingTop: 12, gap: 16 },
	header: { alignItems: "center", gap: 6, paddingVertical: 8 },
	avatar: {
		width: 56,
		height: 56,
		borderRadius: 9999,
		backgroundColor: colors.surface2,
		alignItems: "center",
		justifyContent: "center",
	},
	avatarText: { fontSize: 16, fontWeight: "800", color: colors.textMuted },
	name: { fontSize: 16, fontWeight: "800", color: colors.text },
	muted: { fontSize: 12, color: colors.textMuted },
	statRow: { flexDirection: "row", gap: 8 },
	group: {
		borderRadius: 14,
		overflow: "hidden",
		borderWidth: 1,
		borderColor: colors.border,
	},
	groupRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingVertical: 12,
		paddingHorizontal: 12,
		backgroundColor: colors.surface,
	},
	divider: { borderTopWidth: 1, borderTopColor: colors.border },
	label: { fontSize: 13, fontWeight: "700", color: colors.text },
	value: { fontSize: 12, fontWeight: "700" },
	signOutBtn: {
		height: 46,
		borderRadius: 9999,
		backgroundColor: colors.dangerSoft,
		alignItems: "center",
		justifyContent: "center",
	},
	signOutText: { fontSize: 13, fontWeight: "800", color: colors.danger },
});
