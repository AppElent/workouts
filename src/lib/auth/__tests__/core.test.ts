import { describe, expect, it } from "vitest";
import { clerkErrorMessage, pickError, shouldShowTestLogin } from "../core";

describe("shouldShowTestLogin", () => {
	it("is false on a live key even with creds present", () => {
		expect(
			shouldShowTestLogin({
				VITE_CLERK_PUBLISHABLE_KEY: "pk_live_x",
				VITE_TEST_USER_EMAIL: "test@test.com",
				VITE_TEST_USER_PASSWORD: "secret",
			}),
		).toBe(false);
	});

	it("is false on a test key with no creds", () => {
		expect(
			shouldShowTestLogin({
				VITE_CLERK_PUBLISHABLE_KEY: "pk_test_x",
			}),
		).toBe(false);
	});

	it("is false on a test key with only one of the two creds", () => {
		expect(
			shouldShowTestLogin({
				VITE_CLERK_PUBLISHABLE_KEY: "pk_test_x",
				VITE_TEST_USER_EMAIL: "test@test.com",
			}),
		).toBe(false);
		expect(
			shouldShowTestLogin({
				VITE_CLERK_PUBLISHABLE_KEY: "pk_test_x",
				VITE_TEST_USER_PASSWORD: "secret",
			}),
		).toBe(false);
	});

	it("is false with no publishable key at all", () => {
		expect(
			shouldShowTestLogin({
				VITE_TEST_USER_EMAIL: "test@test.com",
				VITE_TEST_USER_PASSWORD: "secret",
			}),
		).toBe(false);
	});

	it("is true only when both a test key and both creds are present", () => {
		expect(
			shouldShowTestLogin({
				VITE_CLERK_PUBLISHABLE_KEY: "pk_test_x",
				VITE_TEST_USER_EMAIL: "test@test.com",
				VITE_TEST_USER_PASSWORD: "secret",
			}),
		).toBe(true);
	});
});

describe("clerkErrorMessage / pickError", () => {
	it("extracts the first error's longMessage when present", () => {
		const err = { errors: [{ longMessage: "Long", message: "Short" }] };
		expect(clerkErrorMessage(err)).toBe("Long");
		expect(pickError(err)).toBe("Long");
	});

	it("falls back to message when longMessage is absent", () => {
		expect(clerkErrorMessage({ errors: [{ message: "Short" }] })).toBe("Short");
	});

	it("falls back to the default message for non-Clerk errors", () => {
		expect(clerkErrorMessage(new Error("boom"))).toBe("Something went wrong.");
		expect(clerkErrorMessage(undefined)).toBe("Something went wrong.");
	});

	it("accepts a custom fallback", () => {
		expect(clerkErrorMessage(undefined, "Custom fallback")).toBe(
			"Custom fallback",
		);
	});

	it("pickError is the same function as clerkErrorMessage", () => {
		expect(pickError).toBe(clerkErrorMessage);
	});
});
