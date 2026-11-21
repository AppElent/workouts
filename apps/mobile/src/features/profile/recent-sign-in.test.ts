import { hasRecentSignIn, isRecentSignInRefusal } from "./recent-sign-in";

describe("isRecentSignInRefusal", () => {
	it("reads Clerk's reverification hint", () => {
		expect(
			isRecentSignInRefusal({
				clerk_error: { type: "forbidden", reason: "reverification-error" },
			}),
		).toBe(true);
		expect(
			isRecentSignInRefusal({
				clerk_error: { type: "forbidden", reason: "something-else" },
			}),
		).toBe(false);
	});

	it("reads Clerk's API error, on its own or nested", () => {
		expect(
			isRecentSignInRefusal({ code: "session_reverification_required" }),
		).toBe(true);
		expect(
			isRecentSignInRefusal({
				errors: [{ code: "form_param_missing" }],
			}),
		).toBe(false);
		expect(
			isRecentSignInRefusal({
				errors: [{ errors: [{ code: "session_reverification_required" }] }],
			}),
		).toBe(true);
	});

	it("ignores other values and stops at a deep nesting", () => {
		expect(isRecentSignInRefusal(new Error("offline"))).toBe(false);
		expect(isRecentSignInRefusal("session_reverification_required")).toBe(
			false,
		);
		expect(isRecentSignInRefusal(null)).toBe(false);
		let deep: unknown = { code: "session_reverification_required" };
		for (let i = 0; i < 6; i++) deep = { errors: [deep] };
		expect(isRecentSignInRefusal(deep)).toBe(false);
	});
});

describe("hasRecentSignIn", () => {
	it("reloads the session before asking for second_factor within 5 minutes", async () => {
		const calls: string[] = [];
		const session = {
			reload: jest.fn(async () => {
				calls.push("reload");
			}),
			checkAuthorization: jest.fn(() => {
				calls.push("check");
				return true;
			}),
		};
		await expect(hasRecentSignIn({ session })).resolves.toBe(true);
		expect(calls).toEqual(["reload", "check"]);
		expect(session.checkAuthorization).toHaveBeenCalledWith({
			reverification: { level: "second_factor", afterMinutes: 5 },
		});
	});

	it("refuses without a session", async () => {
		await expect(hasRecentSignIn({ session: null })).resolves.toBe(false);
	});
});
