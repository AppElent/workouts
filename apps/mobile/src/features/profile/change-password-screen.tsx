/**
 * Change the password of an account that has one, pushed from Account.
 *
 * iOS AutoFill needs the HIG change-password shape to tell the fields apart:
 * a read-only username (the primary email), the current password
 * (`password`), then the new one (`newPassword`). Without the username it
 * treats both secure fields as new and clears both when its "Use Strong
 * Password?" sheet is declined, without an `onChangeText`. Each field's state
 * therefore also takes the native text from `onEndEditing`, so the action is
 * never enabled while a field shows blank.
 *
 * Clerk reports a wrong current password as `form_password_validation_failed`
 * on `current_password`, the same code as a weak new password, so the
 * parameter decides which field shows the error. Changing signs out the
 * account's other sessions, like the reset flow.
 */
import { useUser } from "@clerk/expo";
import { useRouter } from "expo-router";
import { useState } from "react";
import type { TextInputProps } from "react-native";
import { clerkErrorKey, clerkErrorParam } from "../../auth/clerk-errors";
import { useI18n } from "../../i18n";
import { FormScreen, FormSection, FormTextField } from "../../ui/form";
import { useToast } from "../../ui/toast";
import { useScreenWrite } from "../../ui/use-screen-write";

type Field = "current" | "new";

/** Keeps state on the field's native text, including clears iOS makes silently. */
function nativeText(set: (text: string) => void): TextInputProps {
	return {
		onChangeText: set,
		onEndEditing: (event) => set(event.nativeEvent.text),
	};
}

export function ChangePasswordScreen() {
	const { user } = useUser();
	const { t } = useI18n();
	const c = t.account;
	const toast = useToast();
	const router = useRouter();
	const screenWrite = useScreenWrite();
	const [currentPassword, setCurrentPassword] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [error, setError] = useState<{ field: Field; message: string } | null>(
		null,
	);

	if (!user?.passwordEnabled) return null;
	const busy = screenWrite.isPending("password");

	const submit = () =>
		screenWrite.run(
			c.passwordError,
			async () => {
				setError(null);
				try {
					await user.updatePassword({
						currentPassword,
						newPassword,
						signOutOfOtherSessions: true,
					});
				} catch (failure) {
					const current = clerkErrorParam(failure) === "current_password";
					setError({
						field: current ? "current" : "new",
						message:
							t.authErrors[
								current ? "passwordIncorrect" : clerkErrorKey(failure)
							],
					});
					return;
				}
				toast.success(c.passwordChanged);
				router.back();
			},
			{ key: "password" },
		);

	const errorFor = (field: Field) =>
		error?.field === field ? error.message : undefined;

	return (
		<FormScreen
			primaryAction={{
				label: c.changePassword,
				onPress: () => void submit(),
				loading: busy,
				disabled: !currentPassword || !newPassword,
			}}
		>
			<FormSection footer={c.passwordFooter}>
				<FormTextField
					label={c.email}
					value={user.primaryEmailAddress?.emailAddress ?? ""}
					editable={false}
					autoCapitalize="none"
					autoComplete="username"
					textContentType="username"
				/>
				<FormTextField
					label={c.currentPassword}
					value={currentPassword}
					{...nativeText(setCurrentPassword)}
					error={errorFor("current")}
					secureTextEntry
					autoCapitalize="none"
					autoComplete="current-password"
					textContentType="password"
					autoFocus
				/>
				<FormTextField
					label={c.newPassword}
					value={newPassword}
					{...nativeText(setNewPassword)}
					error={errorFor("new")}
					secureTextEntry
					autoCapitalize="none"
					autoComplete="new-password"
					textContentType="newPassword"
				/>
			</FormSection>
		</FormScreen>
	);
}
