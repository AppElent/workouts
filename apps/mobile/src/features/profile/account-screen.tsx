import { useUser } from "@clerk/expo";
import { useConvex } from "convex/react";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import * as WebBrowser from "expo-web-browser";
import { useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { clerkErrorKey } from "../../auth/clerk-errors";
import { api } from "../../convex/api";
import { useOnline } from "../../convex/online";
import { useQuery } from "../../convex/query-cache";
import { useI18n } from "../../i18n";
import { spacing, useTokens } from "../../theme";
import { useConfirm } from "../../ui/confirm-dialog";
import {
	DisclosureRow,
	FormScreen,
	FormSection,
	FormTextField,
	TextAction,
} from "../../ui/form";
import { AppText } from "../../ui/text";
import { useToast } from "../../ui/toast";
import { useScreenWrite } from "../../ui/use-screen-write";
import { useAccountDeletion } from "../local-data/account-data-maintenance-provider";
import { exportAccountData } from "./account-export";
import { revokeAppleSignIn } from "./apple-revocation";

const PRIVACY_STATEMENT_URL = "https://foundry.appelent.nl/privacy";
const ACCOUNT_TASKS = ["name", "photo", "password", "export"] as const;
type AccountTask = (typeof ACCOUNT_TASKS)[number];

export function AccountScreen() {
	const { user } = useUser();
	const { t } = useI18n();
	const c = t.account;
	const colors = useTokens();
	const toast = useToast();
	const confirm = useConfirm();
	const convex = useConvex();
	const deleteAccountData = useAccountDeletion();
	const online = useOnline();
	const blocker = useQuery(api.account.deletionBlocker, {});
	const [firstName, setFirstName] = useState(user?.firstName ?? "");
	const [lastName, setLastName] = useState(user?.lastName ?? "");
	const [currentPassword, setCurrentPassword] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [passwordError, setPasswordError] = useState<{
		field: "current" | "new";
		message: string;
	} | null>(null);
	const screenWrite = useScreenWrite();
	const busy =
		ACCOUNT_TASKS.find((task) => screenWrite.isPending(task)) ?? null;
	const deletionPending = useRef(false);

	if (!user) return null;
	const name = user.fullName || user.username || t.profile.account;
	const initials = name
		.split(/\s+/)
		.map((part) => part[0])
		.slice(0, 2)
		.join("");
	const nameChanged =
		firstName.trim() !== (user.firstName ?? "") ||
		lastName.trim() !== (user.lastName ?? "");
	const methods = [
		...(user.passwordEnabled ? [c.password] : []),
		...user.externalAccounts.map(
			(account) =>
				account.providerTitle?.() ?? account.provider.replace(/^oauth_/, ""),
		),
	];

	const run = (
		task: AccountTask,
		work: () => Promise<unknown>,
		failure: string,
	) => screenWrite.run(failure, work, { key: [task, "account"] });

	const saveName = () =>
		run(
			"name",
			async () => {
				await user.update({
					firstName: firstName.trim(),
					lastName: lastName.trim(),
				});
				toast.success(c.saved);
			},
			c.saveError,
		);

	/**
	 * Clerk's error lands on the field it is about: a wrong current password
	 * on the first, everything else (too short, breached) on the new one.
	 * Signing out other sessions matches the reset flow.
	 */
	const changePassword = () =>
		run(
			"password",
			async () => {
				setPasswordError(null);
				try {
					await user.updatePassword({
						currentPassword,
						newPassword,
						signOutOfOtherSessions: true,
					});
				} catch (error) {
					const key = clerkErrorKey(error);
					setPasswordError({
						field: key === "passwordIncorrect" ? "current" : "new",
						message: t.authErrors[key],
					});
					return;
				}
				setCurrentPassword("");
				setNewPassword("");
				toast.success(c.passwordChanged);
			},
			c.passwordError,
		);

	const changePhoto = () =>
		run(
			"photo",
			async () => {
				if (!(await ImagePicker.requestMediaLibraryPermissionsAsync()).granted)
					return;
				const result = await ImagePicker.launchImageLibraryAsync({
					mediaTypes: ["images"],
					allowsEditing: true,
					aspect: [1, 1],
					quality: 0.8,
					base64: true,
					exif: false,
				});
				const asset = result.canceled ? null : result.assets[0];
				if (!asset?.base64) return;
				await user.setProfileImage({
					file: `data:${asset.mimeType ?? "image/jpeg"};base64,${asset.base64}`,
				});
				toast.success(c.photoSaved);
			},
			c.photoError,
		);

	const removePhoto = () =>
		run(
			"photo",
			async () => {
				await user.setProfileImage({ file: null });
				toast.success(c.photoSaved);
			},
			c.photoError,
		);

	async function requestDeletion(mode: "deleteData" | "deleteAccount") {
		if (deletionPending.current) return;
		deletionPending.current = true;
		try {
			const confirmed = await confirm({
				title: mode === "deleteData" ? c.deleteData : c.deleteAccount,
				message:
					mode === "deleteData" ? c.deleteDataConfirm : c.deleteAccountConfirm,
				confirmLabel: mode === "deleteData" ? c.deleteData : c.deleteAccount,
				cancelLabel: c.cancel,
				destructive: true,
			});
			if (!confirmed || !user) return;
			if (
				mode === "deleteAccount" &&
				(await revokeAppleSignIn(user, convex)) === "cancelled"
			)
				return;
			deleteAccountData(mode);
		} finally {
			deletionPending.current = false;
		}
	}

	const deletionDisabled = !online || blocker !== null || busy !== null;
	return (
		<FormScreen>
			<FormSection>
				<View style={styles.identity}>
					{user.hasImage ? (
						<Image source={user.imageUrl} style={styles.avatar} />
					) : (
						<View style={[styles.avatar, { backgroundColor: colors.surface2 }]}>
							<AppText variant="heading">{initials}</AppText>
						</View>
					)}
					<View style={styles.identityText}>
						<AppText variant="heading">{name}</AppText>
						<AppText variant="footnote">
							{user.primaryEmailAddress?.emailAddress}
						</AppText>
					</View>
					{busy === "photo" ? <ActivityIndicator /> : null}
				</View>
				<TextAction
					label={c.changePhoto}
					disabled={busy !== null}
					onPress={() => void changePhoto()}
				/>
				{user.hasImage ? (
					<TextAction
						label={c.removePhoto}
						tone="neutral"
						disabled={busy !== null}
						onPress={() => void removePhoto()}
					/>
				) : null}
			</FormSection>

			<FormSection title={c.details}>
				<FormTextField
					label={c.firstName}
					value={firstName}
					onChangeText={setFirstName}
					autoComplete="given-name"
					textContentType="givenName"
				/>
				<FormTextField
					label={c.lastName}
					value={lastName}
					onChangeText={setLastName}
					autoComplete="family-name"
					textContentType="familyName"
				/>
				<TextAction
					label={c.save}
					disabled={!nameChanged || busy !== null}
					onPress={() => void saveName()}
				/>
				{user.emailAddresses.map((address) => (
					<View key={address.id} style={styles.row}>
						<AppText variant="label">{c.email}</AppText>
						<AppText selectable>{address.emailAddress}</AppText>
					</View>
				))}
				{methods.length > 0 ? (
					<View style={styles.row}>
						<AppText variant="label">{c.signInMethods}</AppText>
						<AppText>{methods.join(", ")}</AppText>
					</View>
				) : null}
			</FormSection>

			{user.passwordEnabled ? (
				<FormSection title={c.password} footer={c.passwordFooter}>
					<FormTextField
						label={c.currentPassword}
						value={currentPassword}
						onChangeText={setCurrentPassword}
						error={
							passwordError?.field === "current"
								? passwordError.message
								: undefined
						}
						secureTextEntry
						autoCapitalize="none"
						autoComplete="current-password"
						textContentType="password"
					/>
					<FormTextField
						label={c.newPassword}
						value={newPassword}
						onChangeText={setNewPassword}
						error={
							passwordError?.field === "new" ? passwordError.message : undefined
						}
						secureTextEntry
						autoCapitalize="none"
						autoComplete="new-password"
						textContentType="newPassword"
					/>
					<TextAction
						label={c.changePassword}
						disabled={!currentPassword || !newPassword || busy !== null}
						onPress={() => void changePassword()}
					/>
				</FormSection>
			) : null}

			<FormSection
				title={c.exportTitle}
				footer={online ? c.exportFooter : c.exportOffline}
			>
				<TextAction
					label={busy === "export" ? c.exporting : c.export}
					disabled={!online || busy !== null}
					onPress={() =>
						void run("export", () => exportAccountData(convex), c.exportError)
					}
				/>
			</FormSection>

			<FormSection>
				<DisclosureRow
					label={t.profile.privacy}
					onPress={() => WebBrowser.openBrowserAsync(PRIVACY_STATEMENT_URL)}
				/>
			</FormSection>

			<FormSection
				title={c.dataTitle}
				footer={
					!online
						? c.deletion.offline
						: blocker
							? c.deletion.refusals[blocker]
							: c.deleteDataFooter
				}
			>
				<TextAction
					label={c.deleteData}
					tone="destructive"
					disabled={deletionDisabled}
					onPress={() => void requestDeletion("deleteData")}
				/>
			</FormSection>

			<FormSection
				footer={
					user.deleteSelfEnabled
						? c.deleteAccountFooter
						: c.deleteAccountUnavailable
				}
			>
				<TextAction
					label={c.deleteAccount}
					tone="destructive"
					disabled={deletionDisabled || !user.deleteSelfEnabled}
					onPress={() => void requestDeletion("deleteAccount")}
				/>
			</FormSection>
		</FormScreen>
	);
}

const styles = StyleSheet.create({
	identity: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.md,
		padding: spacing.md,
	},
	identityText: { flex: 1, gap: spacing.xs },
	avatar: {
		width: 52,
		height: 52,
		borderRadius: 26,
		alignItems: "center",
		justifyContent: "center",
	},
	row: { padding: spacing.md, gap: spacing.xs },
});
