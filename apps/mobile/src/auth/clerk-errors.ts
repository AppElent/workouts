/**
 * Clerk's error codes, turned into a catalog message.
 *
 * Every Clerk **Core 3** call (`@clerk/expo`) resolves to
 * `{ error: ClerkError | null }` rather than throwing, and `useSignIn()` /
 * `useSignUp()` additionally expose the last fetch's errors split into
 * `fields` and `global`. Both shapes carry a machine-stable `code` and a
 * `message` Clerk's own docs say not to show to a person, so the code is what
 * gets mapped (`clerkErrorMessageKey` in `@foundry/core`).
 */
import {
	type ClerkErrorMessageKey,
	clerkErrorCode,
	clerkErrorMessageKey,
} from "@foundry/core";
import { useI18n } from "../i18n";

export interface CodedError {
	code: string;
	message?: string;
}

/** The shape of `useSignIn().errors` / `useSignUp().errors`. */
export interface ErrorSignal<TFields extends object> {
	fields: TFields;
	global: readonly CodedError[] | null;
}

/** An unmapped code reads as `generic`; in dev it is logged so the map can grow. */
export function clerkErrorKey(error: unknown): ClerkErrorMessageKey {
	const key = clerkErrorMessageKey(error);
	if (key === "generic" && __DEV__) {
		console.warn(`[auth] unmapped Clerk error code: ${clerkErrorCode(error)}`);
	}
	return key;
}

/** One entry of a thrown Clerk API error, with the form parameter it is about. */
export interface ClerkErrorEntry {
	code: string;
	/** `meta.paramName`, e.g. `current_password`; null for a form-level error. */
	param: string | null;
}

/**
 * The entries of a thrown Clerk API error (`errors[]`), each with its own
 * `meta.paramName`. Clerk reports a wrong current password on
 * `user.updatePassword` as `form_password_validation_failed` on
 * `current_password`, the same code as a weak new one, so only the entry's
 * parameter tells them apart. Empty for anything that is not a Clerk API error.
 */
export function clerkErrorEntries(error: unknown): ClerkErrorEntry[] {
	const errors = (error as { errors?: unknown } | null)?.errors;
	if (!Array.isArray(errors)) return [];
	return errors.flatMap((item) => {
		const entry = item as {
			code?: unknown;
			meta?: { paramName?: unknown };
		} | null;
		if (typeof entry?.code !== "string") return [];
		const param = entry.meta?.paramName;
		return [
			{
				code: entry.code,
				param: typeof param === "string" && param ? param : null,
			},
		];
	});
}

/**
 * What to show after a failed Core 3 call: the hook's field errors first,
 * then its global errors, then the returned error for failures that never
 * reach the signal (no network).
 */
export function pickErrorKey<TFields extends object>(
	errors: ErrorSignal<TFields>,
	returned: CodedError | null,
): ClerkErrorMessageKey | null {
	for (const field of Object.values(errors.fields) as (CodedError | null)[]) {
		if (field) return clerkErrorKey(field);
	}
	const error = errors.global?.[0] ?? returned;
	return error ? clerkErrorKey(error) : null;
}

/** The catalog text for a Clerk error key, in the phone's language. */
export function useClerkErrorText(key: ClerkErrorMessageKey | null) {
	const messages = useI18n().t.authErrors;
	return key ? messages[key] : null;
}
