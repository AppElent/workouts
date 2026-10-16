import { useUser } from "@clerk/expo";
import { useConvex, useConvexConnectionState } from "convex/react";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import * as WebBrowser from "expo-web-browser";
import { useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { api } from "../../convex/api";
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
import { useAccountDeletion } from "../local-data/account-data-maintenance-provider";
import { exportAccountData } from "./account-export";

const PRIVACY_STATEMENT_URL = "https://foundry.appelent.nl/privacy";

export function AccountScreen() {
	const { user } = useUser();
	const { t } = useI18n();
	const c = t.account;
	const colors = useTokens();
	const toast = useToast();
	const confirm = useConfirm();
	const convex = useConvex();
	const deleteAccountData = useAccountDeletion();
	const online = useConvexConnectionState().isWebSocketConnected;
	const blocker = useQuery(api.account.deletionBlocker, {});
	const [firstName, setFirstName] = useState(user?.firstName ?? "");
	const [lastName, setLastName] = useState(user?.lastName ?? "");
	const [busy, setBusy] = useState<"name" | "photo" | "export" | null>(null);
	const pending = useRef(false);

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

	async function run(
		task: "name" | "photo" | "export",
		work: () => Promise<unknown>,
		failure: string,
	) {
		if (pending.current) return;
		pending.current = true;
		setBusy(task);
		try {
			await work();
		} catch {
			toast.error(failure);
		} finally {
			pending.current = false;
			setBusy(null);
		}
	}

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
		if (pending.current) return;
		pending.current = true;
		try {
			if (
				await confirm({
					title: mode === "deleteData" ? c.deleteData : c.deleteAccount,
					message:
						mode === "deleteData"
							? c.deleteDataConfirm
							: c.deleteAccountConfirm,
					confirmLabel: mode === "deleteData" ? c.deleteData : c.deleteAccount,
					cancelLabel: c.cancel,
					destructive: true,
				})
			)
				deleteAccountData(mode);
		} finally {
			pending.current = false;
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
							? c.deletion[blocker]
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
