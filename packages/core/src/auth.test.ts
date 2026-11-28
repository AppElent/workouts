import { describe, expect, it } from "vitest";
import {
	appleWebReturnUrl,
	clerkErrorMessageKey,
	isTestLoginAvailable,
	socialSignInProviders,
} from "./auth";

describe("isTestLoginAvailable", () => {
	const credentials = { email: "test@example.com", password: "secret" };

	it("needs a test instance and both credentials", () => {
		expect(
			isTestLoginAvailable({ publishableKey: "pk_test_abc", ...credentials }),
		).toBe(true);
		expect(
			isTestLoginAvailable({ publishableKey: "pk_live_abc", ...credentials }),
		).toBe(false);
		expect(
			isTestLoginAvailable({
				publishableKey: "pk_test_abc",
				email: "test@example.com",
				password: undefined,
			}),
		).toBe(false);
		expect(
			isTestLoginAvailable({ publishableKey: undefined, ...credentials }),
		).toBe(false);
	});
});

describe("socialSignInProviders", () => {
	it("offers Google only on the development instance", () => {
		expect(socialSignInProviders("pk_test_abc")).toContain("google");
		expect(socialSignInProviders("pk_live_abc")).toEqual([
			"apple",
			"microsoft",
		]);
		expect(socialSignInProviders(undefined)).not.toContain("google");
	});
});

describe("clerkErrorMessageKey", () => {
	it("maps a Clerk code, including one nested in `errors`", () => {
		expect(clerkErrorMessageKey({ code: "form_password_incorrect" })).toBe(
			"passwordIncorrect",
		);
		expect(
			clerkErrorMessageKey({ errors: [{ code: "verification_expired" }] }),
		).toBe("codeExpired");
		expect(clerkErrorMessageKey({ code: "ERR_REQUEST_UNKNOWN" })).toBe(
			"appleSignInIncomplete",
		);
	});

	it.each([
		["form_password_not_strong_enough", "passwordDoesNotMeetRequirements"],
		["form_password_no_uppercase", "passwordDoesNotMeetRequirements"],
		["form_password_no_lowercase", "passwordDoesNotMeetRequirements"],
		["form_password_no_number", "passwordDoesNotMeetRequirements"],
		["form_password_no_special_char", "passwordDoesNotMeetRequirements"],
		["form_conditional_param_missing", "required"],
	])("maps %s to %s (APP-538)", (code, key) => {
		expect(clerkErrorMessageKey({ errors: [{ code }] })).toBe(key);
	});

	it("tells too many wrong codes apart from one wrong code", () => {
		// Dev Clerk, 21 Nov 2026: three wrong codes give `form_code_incorrect`,
		// the fourth `verification_failed` ("Too many failed attempts").
		expect(clerkErrorMessageKey({ code: "form_code_incorrect" })).toBe(
			"codeIncorrect",
		);
		expect(
			clerkErrorMessageKey({ errors: [{ code: "verification_failed" }] }),
		).toBe("codeAttemptsExceeded");
	});

	it("reads the nested code of a Clerk API response error", () => {
		// Shape of @clerk/shared's ClerkAPIResponseError: own wrapper code, the
		// API's codes in `errors[]`.
		const error = Object.assign(new Error("Password is incorrect."), {
			code: "api_response_error",
			status: 422,
			errors: [
				{
					code: "form_password_incorrect",
					message: "Password is incorrect. Try again.",
					longMessage: "Password is incorrect. Try again.",
					meta: { paramName: "password" },
				},
			],
		});
		expect(clerkErrorMessageKey(error)).toBe("passwordIncorrect");
		expect(
			clerkErrorMessageKey(
				Object.assign(new Error("x"), {
					code: "api_response_error",
					errors: [],
				}),
			),
		).toBe("generic");
	});

	it.each([
		"protect_check_timed_out",
		"protect_check_script_load_failed",
		"protect_check_execution_failed",
		"protect_check_aborted",
		"protect_check_invalid_script",
	])("maps the bot challenge's %s to its own key", (code) => {
		expect(clerkErrorMessageKey({ code })).toBe("botCheckFailed");
		expect(clerkErrorMessageKey({ errors: [{ code }] })).toBe("botCheckFailed");
	});

	it("keeps bot-challenge setup errors generic", () => {
		for (const code of [
			"protect_check_already_resolved",
			"protect_check_unsupported_environment",
		]) {
			expect(clerkErrorMessageKey({ code })).toBe("generic");
		}
	});

	it("falls back to the generic key for anything unmapped", () => {
		expect(clerkErrorMessageKey({ code: "something_new" })).toBe("generic");
		expect(clerkErrorMessageKey({ code: "toString" })).toBe("generic");
		expect(clerkErrorMessageKey(null)).toBe("generic");
	});
});

describe("appleWebReturnUrl", () => {
	const registered = ["https://foundry.appelent.nl/account"];

	it("is the Account page of a registered origin", () => {
		expect(appleWebReturnUrl("https://foundry.appelent.nl", registered)).toBe(
			"https://foundry.appelent.nl/account",
		);
	});

	it("is null for an origin Apple does not know", () => {
		expect(appleWebReturnUrl("https://evil.example", registered)).toBeNull();
		expect(appleWebReturnUrl("http://localhost:3000", registered)).toBeNull();
	});
});
