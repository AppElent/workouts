import { useAuth, useUser } from "@clerk/expo";
import * as Sentry from "@sentry/react-native";
import { useConvexConnectionState } from "convex/react";
import Constants from "expo-constants";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { useI18n } from "../../i18n";
import { radius, spacing, useAppearance, useTokens } from "../../theme";
import { useConfirm } from "../../ui/confirm-dialog";
import { DisclosureRow, FormScreen, FormSection } from "../../ui/form";
import { AppText } from "../../ui/text";
import { useToast } from "../../ui/toast";

export function ProfileScreen() {
	const { user } = useUser();
	const { signOut } = useAuth();
	const { preference } = useAppearance();
	const { t, locale } = useI18n();
	const c = t.profile;
	const colors = useTokens();
	const router = useRouter();
	const confirm = useConfirm();
	const toast = useToast();
	const online = useConvexConnectionState().isWebSocketConnected;
	const [busy, setBusy] = useState(false);
	const pending = useRef(false);
	const name = user?.fullName || user?.username || c.account;
	const email = user?.primaryEmailAddress?.emailAddress;
	const initials = name
		.split(/\s+/)
		.map((part) => part[0])
		.slice(0, 2)
		.join("");
	async function leave() {
		if (pending.current) return;
		pending.current = true;
		try {
			if (
				!(await confirm({
					title: c.signOutTitle,
					message: c.signOutMessage,
					confirmLabel: c.signOut,
					cancelLabel: c.cancel,
					destructive: true,
				}))
			)
				return;
			setBusy(true);
			await signOut();
		} catch {
			toast.error(c.signOutError);
		} finally {
			pending.current = false;
			setBusy(false);
		}
	}
	return (
		<FormScreen>
			{!online ? <AppText variant="footnote">{c.offline}</AppText> : null}
			<Pressable
				accessibilityRole="button"
				accessibilityLabel={`${c.accountDetails}, ${name}${email ? `, ${email}` : ""}`}
				onPress={() => router.push("/account")}
				style={{
					flexDirection: "row",
					alignItems: "center",
					gap: spacing.md,
					padding: spacing.md,
					borderRadius: radius.card,
					backgroundColor: colors.surface,
				}}
			>
				{user?.imageUrl ? (
					<Image
						source={user.imageUrl}
						style={{ width: 52, height: 52, borderRadius: 26 }}
					/>
				) : (
					<View
						style={{
							width: 52,
							height: 52,
							borderRadius: 26,
							backgroundColor: colors.surface2,
							alignItems: "center",
							justifyContent: "center",
						}}
					>
						<AppText variant="heading">{initials}</AppText>
					</View>
				)}
				<View style={{ flex: 1, gap: spacing.xs }}>
					<AppText variant="heading">{name}</AppText>
					{email ? <AppText variant="footnote">{email}</AppText> : null}
				</View>
				<AppText variant="body">›</AppText>
			</Pressable>
			<FormSection footer={c.totalsUnavailable}>
				<View style={{ flexDirection: "row", padding: spacing.md }}>
					{[c.sessions, c.distance, c.records].map((label) => (
						<View
							key={label}
							style={{ flex: 1, alignItems: "center", gap: spacing.xs }}
						>
							<AppText variant="metric">—</AppText>
							<AppText variant="caption">{label}</AppText>
						</View>
					))}
				</View>
				<DisclosureRow
					label={c.allActivity}
					onPress={() => router.push("/activity-history")}
				/>
			</FormSection>
			<FormSection title={t.preferences.heading} separatorInset={56}>
				<DisclosureRow
					label={t.preferences.appearance}
					value={t.appearance[preference]}
					icon={{
						name: {
							ios: "circle.lefthalf.filled",
							android: "contrast",
							web: "contrast",
						},
						color: "#5856d6",
					}}
					onPress={() => router.push("/appearance")}
				/>
				<DisclosureRow
					label={t.preferences.language}
					value={t.language.names[locale]}
					icon={{
						name: { ios: "globe", android: "language", web: "language" },
						color: "#007aff",
					}}
					onPress={() => router.push("/language")}
				/>
			</FormSection>
			<FormSection title={c.nutrition} separatorInset={56}>
				<DisclosureRow
					label={c.goals}
					icon={{
						name: { ios: "target", android: "my_location", web: "my_location" },
						color: "#ff9500",
					}}
					onPress={() => router.push("/nutrition-goals")}
				/>
				<DisclosureRow
					label={c.library}
					icon={{
						name: {
							ios: "books.vertical.fill",
							android: "library_books",
							web: "library_books",
						},
						color: "#34c759",
					}}
					onPress={() => router.push("/nutrition-library")}
				/>
				<DisclosureRow
					label={t.preferences.personalMeasures}
					icon={{
						name: {
							ios: "ruler.fill",
							android: "straighten",
							web: "straighten",
						},
						color: "#af52de",
					}}
					onPress={() => router.push("/personal-measures")}
				/>
				<DisclosureRow
					label={c.backup}
					icon={{
						name: { ios: "icloud.fill", android: "cloud", web: "cloud" },
						color: "#5ac8fa",
					}}
					onPress={() => router.push("/nutrition-settings")}
				/>
			</FormSection>
			<FormSection>
				<DisclosureRow
					label={t.feedback.report}
					onPress={() => {
						try {
							Sentry.showFeedbackForm();
						} catch {
							toast.error(t.feedback.trigger);
						}
					}}
				/>
				<DisclosureRow
					label={t.diaryEntry.labs}
					onPress={() => router.push("/labs")}
				/>
			</FormSection>
			<FormSection>
				<Pressable
					accessibilityRole="button"
					accessibilityLabel={c.signOut}
					disabled={busy}
					onPress={() => void leave()}
					style={{
						minHeight: 48,
						justifyContent: "center",
						padding: spacing.md,
					}}
				>
					<AppText style={{ color: colors.danger }}>{c.signOut}</AppText>
				</Pressable>
			</FormSection>
			<AppText variant="caption" style={{ textAlign: "center" }}>
				Foundry {Constants.expoConfig?.version ?? ""}
			</AppText>
		</FormScreen>
	);
}
