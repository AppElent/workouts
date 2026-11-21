import { beforeEach, expect, it, vi } from "vitest";
import { type AppleIdAuth, revokeAppleSignIn } from "./appleRevocation";

const mocks = vi.hoisted(() => ({ report: vi.fn() }));
vi.mock("#/lib/observability/errors", () => ({ reportError: mocks.report }));

const ORIGIN = "https://foundry.appelent.nl";
const RETURN_URL = `${ORIGIN}/account`;
const appleUser = {
	externalAccounts: [{ provider: "oauth_apple", providerUserId: "apple-sub" }],
};

function idToken(sub: string) {
	const part = (value: object) =>
		btoa(JSON.stringify(value))
			.replace(/\+/g, "-")
			.replace(/\//g, "_")
			.replace(/=+$/, "");
	return `${part({ alg: "RS256" })}.${part({ sub })}.signature`;
}

function apple(
	result: (state: string) => Promise<{
		authorization: { code?: string; id_token?: string; state?: string };
	}>,
) {
	let state = "";
	const auth: AppleIdAuth = {
		init: vi.fn((config) => {
			state = config.state;
		}),
		signIn: vi.fn(() => result(state)),
	};
	return auth;
}

const signedIn = (sub = "apple-sub", code: string | undefined = "code") =>
	apple(async (state) => ({
		authorization: { code, id_token: idToken(sub), state },
	}));

function run(auth: AppleIdAuth, user = appleUser, returnUrls = [RETURN_URL]) {
	const revoke = vi.fn().mockResolvedValue(null);
	const result = revokeAppleSignIn(user, revoke, {
		origin: ORIGIN,
		returnUrls,
		loadApple: async () => auth,
	});
	return { revoke, result };
}

beforeEach(() => vi.clearAllMocks());

it("sends the popup's code with the Services ID and return URL", async () => {
	const auth = signedIn();
	const { revoke, result } = run(auth);
	await expect(result).resolves.toBe("revoked");
	expect(auth.init).toHaveBeenCalledWith(
		expect.objectContaining({
			clientId: "nl.appelent.web",
			redirectURI: RETURN_URL,
			usePopup: true,
		}),
	);
	expect(revoke).toHaveBeenCalledWith({
		authorizationCode: "code",
		bundleId: "nl.appelent.web",
		redirectUri: RETURN_URL,
	});
});

it("skips accounts without Apple and origins Apple does not know", async () => {
	const auth = signedIn();
	const noApple = run(auth, { externalAccounts: [] });
	await expect(noApple.result).resolves.toBe("notLinked");
	// Linked but skipped: the grant stays, and the confirmation says so.
	const unregistered = run(auth, appleUser, []);
	await expect(unregistered.result).resolves.toBe("notRevoked");
	expect(auth.signIn).not.toHaveBeenCalled();
	expect(noApple.revoke).not.toHaveBeenCalled();
	expect(unregistered.revoke).not.toHaveBeenCalled();
});

it("cancels the deletion when the popup is closed", async () => {
	const auth = apple(() => Promise.reject({ error: "popup_closed_by_user" }));
	const { revoke, result } = run(auth);
	await expect(result).resolves.toBe("cancelled");
	expect(revoke).not.toHaveBeenCalled();
	expect(mocks.report).not.toHaveBeenCalled();
});

it("never revokes another Apple Account's grant", async () => {
	const { revoke, result } = run(signedIn("someone-else"));
	await expect(result).resolves.toBe("notRevoked");
	expect(revoke).not.toHaveBeenCalled();
	expect(mocks.report).toHaveBeenCalledOnce();
});

it("rejects a response for another request", async () => {
	const auth = apple(async () => ({
		authorization: { code: "code", id_token: idToken("apple-sub"), state: "x" },
	}));
	const { revoke, result } = run(auth);
	await expect(result).resolves.toBe("notRevoked");
	expect(revoke).not.toHaveBeenCalled();
});

it("reports a failed revocation and lets the deletion continue", async () => {
	const auth = signedIn();
	const revoke = vi.fn().mockRejectedValue(new Error("failed"));
	await expect(
		revokeAppleSignIn(appleUser, revoke, {
			origin: ORIGIN,
			returnUrls: [RETURN_URL],
			loadApple: async () => auth,
		}),
	).resolves.toBe("notRevoked");
	expect(mocks.report).toHaveBeenCalledWith(
		expect.any(Error),
		"account.revokeAppleSignIn",
	);
});

it("reads the Apple user from a base64url ID token", async () => {
	// "~~~" and "???" encode to "-" and "_" in base64url.
	const sub = "001234.~~~???.0001";
	const auth = signedIn(sub);
	const { revoke, result } = run(auth, {
		externalAccounts: [{ provider: "oauth_apple", providerUserId: sub }],
	});
	await expect(result).resolves.toBe("revoked");
	expect(revoke).toHaveBeenCalledOnce();
});

it("stops the deletion when the browser blocks the popup", async () => {
	const auth = apple(() =>
		Promise.reject({ error: "popup_blocked_by_browser" }),
	);
	const { revoke, result } = run(auth);
	await expect(result).resolves.toBe("popupBlocked");
	expect(revoke).not.toHaveBeenCalled();
	expect(mocks.report).not.toHaveBeenCalled();
});
