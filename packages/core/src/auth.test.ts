import { describe, expect, it } from "vitest";
import {
	CLERK_ERROR_CODE_MAP,
	CLERK_ERROR_MESSAGE_KEYS,
	clerkErrorMessageKey,
	isTestLoginAvailable,
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

	it("falls back to the generic key for anything unmapped", () => {
		expect(clerkErrorMessageKey({ code: "something_new" })).toBe("generic");
		expect(clerkErrorMessageKey({ code: "toString" })).toBe("generic");
		expect(clerkErrorMessageKey(null)).toBe("generic");
	});

	it("only maps to keys the clients translate", () => {
		for (const key of Object.values(CLERK_ERROR_CODE_MAP))
			expect(CLERK_ERROR_MESSAGE_KEYS).toContain(key);
	});
});
