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
 * on `current_password`, the same code as a weak new password, so each error
 * entry goes to the field its own `meta.paramName` names (`fieldErrors`).
 * Entries about no field, and failures that are not Clerk API errors (no
 * network), show as a toast. Changing signs out the account's other sessions,
 * like the reset flow.
 */
import { useUser } from "@clerk/expo";
import type { ClerkErrorMessageKey } from "@foundry/core";
import { useRouter } from "expo-router";
import { useState } from "react";
import type { TextInputProps } from "react-native";
import { clerkErrorEntries, clerkErrorKey } from "../../auth/clerk-errors";
import { useI18n } from "../../i18n";
import { FormScreen, FormSection, FormTextField } from "../../ui/form";
import { useToast } from "../../ui/toast";
import { useScreenWrite } from "../../ui/use-screen-write";

type Field = "current" | "new";
type FieldErrors = Partial<Record<Field, ClerkErrorMessageKey>>;

const FIELD_BY_PARAM: Record<string, Field> = {
	current_password: "current",
	new_password: "new",
	password: "new",
};

/** Codes Clerk uses on `current_password` when that password is wrong. */
const WRONG_CURRENT = new Set([
	"form_password_validation_failed",
	"form_password_incorrect",
]);

/** Sorts a failed `updatePassword` by field: the first entry per field wins. */
function fieldErrors(failure: unknown): {
	fields: FieldErrors;
	form: ClerkErrorMessageKey | null;
} {
	const fields: FieldErrors = {};
	let form: ClerkErrorMessageKey | null = null;
	const entries = clerkErrorEntries(failure);
	for (const entry of entries) {
		const field = entry.param ? FIELD_BY_PARAM[entry.param] : undefined;
		if (!field) {
			form ??= clerkErrorKey(entry);
		} else if (!fields[field]) {
			fields[field] =
				field === "current" && WRONG_CURRENT.has(entry.code)
					? "passwordIncorrect"
					: clerkErrorKey(entry);
		}
	}
	if (entries.length === 0) form = clerkErrorKey(failure);
	return { fields, form };
}

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
	const [errors, setErrors] = useState<FieldErrors>({});

	if (!user?.passwordEnabled) return null;
	const busy = screenWrite.isPending("password");

	const submit = () =>
		screenWrite.run(
			c.passwordError,
			async () => {
				setErrors({});
				try {
					await user.updatePassword({
						currentPassword,
						newPassword,
						signOutOfOtherSessions: true,
					});
				} catch (failure) {
					const { fields, form } = fieldErrors(failure);
					setErrors(fields);
					if (form) toast.error(t.authErrors[form]);
					return;
				}
				toast.success(c.passwordChanged);
				router.back();
			},
			{ key: "password" },
		);

	const errorFor = (field: Field) => {
		const key = errors[field];
		return key ? t.authErrors[key] : undefined;
	};

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
