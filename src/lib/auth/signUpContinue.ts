/**
 * The continue step of a social sign-up on the web (APP-518). Clerk creates
 * the sign-up from the provider's data and stops at `missing_requirements`
 * when the instance requires a field the provider did not give, or an email
 * address or phone number still has to be verified.
 */
import type { useSignUp } from "@clerk/react";

export type SignUp = ReturnType<typeof useSignUp>["signUp"];

/** The missing fields this form can ask for, in the order it shows them. */
const CONTINUE_FIELDS = [
	"email_address",
	"username",
	"first_name",
	"last_name",
	"phone_number",
	"password",
] as const;
export type ContinueField = (typeof CONTINUE_FIELDS)[number];

const VERIFIABLE_FIELDS = ["email_address", "phone_number"] as const;
export type VerifiableField = (typeof VERIFIABLE_FIELDS)[number];

/** The attempt was started with a social provider, not with this form. */
export function isSocialSignUp(signUp: SignUp) {
	return !!signUp.verifications.externalAccount?.strategy?.startsWith("oauth_");
}

/** An open social sign-up that only lacks fields or a verification. */
export function isResumable(signUp: SignUp) {
	return (
		!!signUp.id &&
		signUp.status === "missing_requirements" &&
		isSocialSignUp(signUp)
	);
}

export type ContinuePhase =
	| { kind: "details"; fields: ContinueField[] }
	| { kind: "verify"; field: VerifiableField }
	/** Everything is in; a failed `finalize()` is retried from here. */
	| { kind: "finish" }
	/** Clerk wants something this form has no input for. */
	| { kind: "unsupported" };

/** What to ask next. Fields come first: a typed email then needs its code. */
export function continuePhase(signUp: SignUp): ContinuePhase {
	if (signUp.status === "complete") return { kind: "finish" };
	const missing: readonly string[] = signUp.missingFields;
	if (missing.length > 0) {
		const fields = CONTINUE_FIELDS.filter((f) => missing.includes(f));
		return fields.length === missing.length
			? { kind: "details", fields }
			: { kind: "unsupported" };
	}
	const unverified: readonly string[] = signUp.unverifiedFields;
	const field = VERIFIABLE_FIELDS.find((f) => unverified.includes(f));
	return field ? { kind: "verify", field } : { kind: "unsupported" };
}

export type ContinueValues = Partial<Record<ContinueField, string>>;

/**
 * Sends only the asked-for fields. The type of `update` leaves out `password`,
 * but it patches the attempt with whatever it gets, as Clerk's own continue
 * form does.
 */
export function updateSignUp(
	signUp: SignUp,
	fields: ContinueField[],
	values: ContinueValues,
): Promise<{ error: unknown }> {
	const all = {
		email_address: { emailAddress: values.email_address?.trim() },
		username: { username: values.username?.trim() },
		first_name: { firstName: values.first_name?.trim() },
		last_name: { lastName: values.last_name?.trim() },
		phone_number: { phoneNumber: values.phone_number?.replace(/[\s()-]/g, "") },
		password: { password: values.password },
	};
	const params: Parameters<SignUp["update"]>[0] & { password?: string } =
		Object.assign({}, ...fields.map((f) => all[f]));
	return signUp.update(params);
}

/** The field a Clerk error is about, when it names one. */
export function errorField(error: unknown): string | undefined {
	const first = (
		error as { errors?: { meta?: { paramName?: string } }[] } | null
	)?.errors?.[0];
	return first?.meta?.paramName;
}

export function sendFieldCode(
	signUp: SignUp,
	field: VerifiableField,
): Promise<{ error: unknown }> {
	return field === "email_address"
		? signUp.verifications.sendEmailCode()
		: signUp.verifications.sendPhoneCode();
}

export function verifyFieldCode(
	signUp: SignUp,
	field: VerifiableField,
	code: string,
): Promise<{ error: unknown }> {
	return field === "email_address"
		? signUp.verifications.verifyEmailCode({ code })
		: signUp.verifications.verifyPhoneCode({ code });
}
