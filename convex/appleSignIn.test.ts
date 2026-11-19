/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import { clientSecret, revokeAppleAuthorization } from "./lib/appleSignIn";
import { verifiedAppleUserIds } from "./lib/clerkUsers";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");

async function appleKey() {
	const pair = await crypto.subtle.generateKey(
		{ name: "ECDSA", namedCurve: "P-256" },
		true,
		["sign", "verify"],
	);
	const der = new Uint8Array(
		await crypto.subtle.exportKey("pkcs8", pair.privateKey),
	);
	const body = btoa(String.fromCharCode(...der))
		.match(/.{1,64}/g)
		?.join("\n");
	return {
		publicKey: pair.publicKey,
		pem: `-----BEGIN PRIVATE KEY-----\n${body}\n-----END PRIVATE KEY-----`,
	};
}

function decode(part: string) {
	const base64 = part.replace(/-/g, "+").replace(/_/g, "/");
	return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

async function configure() {
	const key = await appleKey();
	vi.stubEnv("APPLE_TEAM_ID", "TEAM123456");
	vi.stubEnv("APPLE_SIGN_IN_KEY_ID", "KEY1234567");
	// Infisical exports may carry the newlines escaped.
	vi.stubEnv("APPLE_SIGN_IN_PRIVATE_KEY", key.pem.replace(/\n/g, "\\n"));
	return key;
}

function appleResponses(responses: Record<string, Response>): {
	calls: { path: string; form: URLSearchParams }[];
} {
	const calls: { path: string; form: URLSearchParams }[] = [];
	vi.stubGlobal(
		"fetch",
		vi.fn(async (url: string, init: RequestInit) => {
			const path = new URL(url).pathname;
			calls.push({ path, form: new URLSearchParams(String(init.body)) });
			return responses[path] ?? new Response("not_found", { status: 404 });
		}),
	);
	return { calls };
}

afterEach(() => {
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
});

describe("Sign in with Apple client secret", () => {
	it("is an ES256 JWT for the bundle ID, signed with the Apple key", async () => {
		const key = await appleKey();
		const now = Date.UTC(2026, 9, 18);
		const jwt = await clientSecret(
			{ teamId: "TEAM123456", keyId: "KEY1234567", privateKey: key.pem },
			"com.appelent.foundry",
			now,
		);
		const [header, claims, signature] = jwt.split(".");
		expect(JSON.parse(new TextDecoder().decode(decode(header)))).toEqual({
			alg: "ES256",
			kid: "KEY1234567",
		});
		expect(JSON.parse(new TextDecoder().decode(decode(claims)))).toEqual({
			iss: "TEAM123456",
			iat: now / 1000,
			exp: now / 1000 + 300,
			aud: "https://appleid.apple.com",
			sub: "com.appelent.foundry",
		});
		await expect(
			crypto.subtle.verify(
				{ name: "ECDSA", hash: "SHA-256" },
				key.publicKey,
				decode(signature),
				new TextEncoder().encode(`${header}.${claims}`),
			),
		).resolves.toBe(true);
	});
});

describe("account.revokeAppleSignIn", () => {
	it("requires a signed-in account", async () => {
		await configure();
		const t = convexTest(schema, modules);
		await expect(
			t.action(api.account.revokeAppleSignIn, {
				authorizationCode: "code",
				bundleId: "com.appelent.foundry",
			}),
		).rejects.toMatchObject({ data: { code: "unauthenticated" } });
	});

	it("reports missing Apple credentials instead of calling Apple", async () => {
		const { calls } = appleResponses({});
		const alice = convexTest(schema, modules).withIdentity({
			subject: "alice",
		});
		await expect(
			alice.action(api.account.revokeAppleSignIn, {
				authorizationCode: "code",
				bundleId: "com.appelent.foundry",
			}),
		).rejects.toMatchObject({ data: { code: "unavailable" } });
		expect(calls).toEqual([]);
	});

	it("rejects a bundle ID that is not a Foundry build", async () => {
		await configure();
		const { calls } = appleResponses({});
		const alice = convexTest(schema, modules).withIdentity({
			subject: "alice",
		});
		await expect(
			alice.action(api.account.revokeAppleSignIn, {
				authorizationCode: "code",
				bundleId: "com.example.other",
			}),
		).rejects.toMatchObject({ data: { code: "invalid", field: "bundleId" } });
		expect(calls).toEqual([]);
	});

	it("uses the bundle ID of the build that asked", async () => {
		await configure();
		const { calls } = appleResponses({
			"/auth/token": Response.json({ refresh_token: "refresh" }),
			"/auth/revoke": new Response(null, { status: 200 }),
		});
		const alice = convexTest(schema, modules).withIdentity({
			subject: "alice",
		});
		await alice.action(api.account.revokeAppleSignIn, {
			authorizationCode: "code",
			bundleId: "com.appelent.foundry.preview",
		});
		expect(calls.map(({ form }) => form.get("client_id"))).toEqual([
			"com.appelent.foundry.preview",
			"com.appelent.foundry.preview",
		]);
	});

	it("exchanges the code and revokes the refresh token", async () => {
		await configure();
		const { calls } = appleResponses({
			"/auth/token": Response.json({
				access_token: "access",
				refresh_token: "refresh",
			}),
			"/auth/revoke": new Response(null, { status: 200 }),
		});
		const alice = convexTest(schema, modules).withIdentity({
			subject: "alice",
		});
		await alice.action(api.account.revokeAppleSignIn, {
			authorizationCode: "code",
			bundleId: "com.appelent.foundry",
		});
		expect(calls.map(({ path }) => path)).toEqual([
			"/auth/token",
			"/auth/revoke",
		]);
		const [exchange, revoke] = calls.map(({ form }) =>
			Object.fromEntries(form),
		);
		expect(exchange).toMatchObject({
			client_id: "com.appelent.foundry",
			code: "code",
			grant_type: "authorization_code",
		});
		expect(revoke).toMatchObject({
			client_id: "com.appelent.foundry",
			token: "refresh",
			token_type_hint: "refresh_token",
		});
		expect(revoke.client_secret).toBe(exchange.client_secret);
	});

	it("fails with one stable code when Apple rejects the code", async () => {
		await configure();
		vi.spyOn(console, "error").mockImplementation(() => {});
		const { calls } = appleResponses({
			"/auth/token": Response.json({ error: "invalid_grant" }, { status: 400 }),
		});
		const alice = convexTest(schema, modules).withIdentity({
			subject: "alice",
		});
		await expect(
			alice.action(api.account.revokeAppleSignIn, {
				authorizationCode: "code",
				bundleId: "com.appelent.foundry",
			}),
		).rejects.toMatchObject({ data: { code: "failed" } });
		expect(calls.map(({ path }) => path)).toEqual(["/auth/token"]);
	});
});

describe("web Apple revocation", () => {
	it("refuses a web code without a registered return URL, before calling Apple", async () => {
		await configure();
		const { calls } = appleResponses({});
		const alice = convexTest(schema, modules).withIdentity({
			subject: "alice",
		});
		for (const redirectUri of [undefined, "https://evil.example/account"])
			await expect(
				alice.action(api.account.revokeAppleSignIn, {
					authorizationCode: "code",
					bundleId: "nl.appelent.web",
					redirectUri,
				}),
			).rejects.toMatchObject({
				data: { code: "invalid", field: "redirectUri" },
			});
		expect(calls).toEqual([]);
	});

	it("refuses a return URL on a native code", async () => {
		await configure();
		const { calls } = appleResponses({});
		const alice = convexTest(schema, modules).withIdentity({
			subject: "alice",
		});
		await expect(
			alice.action(api.account.revokeAppleSignIn, {
				authorizationCode: "code",
				bundleId: "com.appelent.foundry",
				redirectUri: "https://foundry.appelent.nl/account",
			}),
		).rejects.toMatchObject({
			data: { code: "invalid", field: "redirectUri" },
		});
		expect(calls).toEqual([]);
	});

	it("exchanges a web code for the Services ID with its return URL", async () => {
		const key = await appleKey();
		const { calls } = appleResponses({
			"/auth/token": Response.json({ refresh_token: "refresh" }),
			"/auth/revoke": new Response(null, { status: 200 }),
		});
		await revokeAppleAuthorization(
			{ teamId: "TEAM123456", keyId: "KEY1234567", privateKey: key.pem },
			"code",
			"nl.appelent.web",
			"https://foundry.appelent.nl/account",
		);
		const [exchange, revoke] = calls.map(({ form }) =>
			Object.fromEntries(form),
		);
		expect(exchange).toMatchObject({
			client_id: "nl.appelent.web",
			redirect_uri: "https://foundry.appelent.nl/account",
		});
		expect(revoke).toMatchObject({
			client_id: "nl.appelent.web",
			token: "refresh",
		});
		expect(revoke.redirect_uri).toBeUndefined();
	});
});

describe("web Apple revocation server checks", () => {
	const WEB = {
		authorizationCode: "code",
		bundleId: "nl.appelent.web",
		redirectUri: "https://foundry.appelent.nl/account",
	};

	function idToken(claims: Record<string, unknown>) {
		const part = (value: unknown) =>
			btoa(JSON.stringify(value))
				.replace(/\+/g, "-")
				.replace(/\//g, "_")
				.replace(/=+$/, "");
		return `${part({ alg: "RS256" })}.${part(claims)}.signature`;
	}

	function appleToken(sub: string, overrides: Record<string, unknown> = {}) {
		return Response.json({
			refresh_token: "refresh",
			id_token: idToken({
				iss: "https://appleid.apple.com",
				aud: "nl.appelent.web",
				sub,
				...overrides,
			}),
		});
	}

	/** Alice's Apple link as the Clerk webhook mirrors it; none when empty. */
	async function setUp(
		responses: Record<string, Response>,
		appleUserIds: string[] = ["apple-alice"],
	) {
		await configure();
		vi.spyOn(console, "error").mockImplementation(() => {});
		const result = appleResponses(responses);
		const t = convexTest(schema, modules);
		if (appleUserIds.length > 0)
			await t.mutation(internal.account.syncAppleLink, {
				userId: "alice",
				appleUserIds,
				clerkUpdatedAt: 1,
			});
		return { ...result, t, alice: t.withIdentity({ subject: "alice" }) };
	}

	const paths = (calls: { path: string }[]) => calls.map(({ path }) => path);

	it("checks the deletion blocker before exchanging the code", async () => {
		const { alice, calls } = await setUp({
			"/auth/token": appleToken("apple-alice"),
			"/auth/revoke": new Response(null, { status: 200 }),
		});
		await alice.mutation(api.workoutSessions.create, {});
		await expect(
			alice.action(api.account.revokeAppleSignIn, WEB),
		).rejects.toMatchObject({ data: { code: "activeActivity" } });
		expect(calls).toEqual([]);
	});

	it("revokes when the code's Apple user is the one mirrored for the caller", async () => {
		const { alice, calls } = await setUp({
			"/auth/token": appleToken("apple-alice"),
			"/auth/revoke": new Response(null, { status: 200 }),
		});
		await alice.action(api.account.revokeAppleSignIn, WEB);
		expect(paths(calls)).toEqual(["/auth/token", "/auth/revoke"]);
		expect(Object.fromEntries(calls[1].form)).toMatchObject({
			token: "refresh",
		});
	});

	it("binds to the caller's link, not another account's", async () => {
		const { t, alice, calls } = await setUp(
			{
				"/auth/token": appleToken("apple-bob"),
				"/auth/revoke": new Response(null, { status: 200 }),
			},
			["apple-alice"],
		);
		await t.mutation(internal.account.syncAppleLink, {
			userId: "bob",
			appleUserIds: ["apple-bob"],
			clerkUpdatedAt: 1,
		});
		await expect(
			alice.action(api.account.revokeAppleSignIn, WEB),
		).rejects.toMatchObject({ data: { code: "appleAccountMismatch" } });
		expect(paths(calls)).toEqual(["/auth/token"]);
	});

	it("refuses an ID token for another audience or issuer, or without one", async () => {
		for (const token of [
			appleToken("apple-alice", { aud: "com.example.other" }),
			appleToken("apple-alice", { iss: "https://evil.example" }),
			Response.json({ refresh_token: "refresh" }),
		]) {
			const { alice, calls } = await setUp({
				"/auth/token": token,
				"/auth/revoke": new Response(null, { status: 200 }),
			});
			await expect(
				alice.action(api.account.revokeAppleSignIn, WEB),
			).rejects.toMatchObject({ data: { code: "appleAccountMismatch" } });
			expect(paths(calls)).not.toContain("/auth/revoke");
		}
	});

	it("does not exchange the code without a mirrored Apple link", async () => {
		const { alice, calls } = await setUp(
			{ "/auth/token": appleToken("apple-alice") },
			[],
		);
		await expect(
			alice.action(api.account.revokeAppleSignIn, WEB),
		).rejects.toMatchObject({ data: { code: "appleAccountMismatch" } });
		expect(calls).toEqual([]);
	});

	it("refuses connected apps before any lookup", async () => {
		const { t, calls } = await setUp({});
		const app = t.withIdentity({
			subject: "alice",
			client_id: "mcp-client",
			scope: "foundry:read foundry:write",
		});
		await expect(
			app.action(api.account.revokeAppleSignIn, WEB),
		).rejects.toMatchObject({ data: { code: "readOnly" } });
		expect(calls).toEqual([]);
	});

	it("refuses an unregistered return URL before any lookup", async () => {
		const { alice, calls } = await setUp({});
		await expect(
			alice.action(api.account.revokeAppleSignIn, {
				...WEB,
				redirectUri: "https://foundry-stg.appelent.nl/account",
			}),
		).rejects.toMatchObject({
			data: { code: "invalid", field: "redirectUri" },
		});
		expect(calls).toEqual([]);
	});

	it("keeps native revocation unbound", async () => {
		const { alice, calls } = await setUp(
			{
				"/auth/token": appleToken("apple-bob", {
					aud: "com.appelent.foundry",
				}),
				"/auth/revoke": new Response(null, { status: 200 }),
			},
			[],
		);
		await alice.action(api.account.revokeAppleSignIn, {
			authorizationCode: "code",
			bundleId: "com.appelent.foundry",
		});
		expect(paths(calls)).toEqual(["/auth/token", "/auth/revoke"]);
	});
});

describe("Apple link mirror", () => {
	const links = (t: ReturnType<typeof convexTest>) =>
		t.run((ctx) => ctx.db.query("appleSignInLinks").collect());

	it("keeps the newest delivery and drops the row when Apple is unlinked", async () => {
		const t = convexTest(schema, modules);
		const sync = (appleUserIds: string[], clerkUpdatedAt: number) =>
			t.mutation(internal.account.syncAppleLink, {
				userId: "alice",
				appleUserIds,
				clerkUpdatedAt,
			});
		await sync(["apple-1"], 10);
		await sync(["apple-1"], 10);
		await sync(["apple-old"], 5);
		expect(await links(t)).toMatchObject([
			{ userId: "alice", appleUserIds: ["apple-1"], clerkUpdatedAt: 10 },
		]);
		await sync(["apple-2"], 20);
		expect((await links(t))[0].appleUserIds).toEqual(["apple-2"]);
		await sync([], 30);
		expect(await links(t)).toEqual([]);
	});

	it("backfills in bounded batches with the same rules", async () => {
		const t = convexTest(schema, modules);
		await t.mutation(internal.account.syncAppleLink, {
			userId: "alice",
			appleUserIds: ["apple-new"],
			clerkUpdatedAt: 20,
		});
		await t.mutation(internal.account.backfillAppleLinks, {
			links: [
				{ userId: "alice", appleUserIds: ["apple-stale"], clerkUpdatedAt: 10 },
				{ userId: "bob", appleUserIds: ["apple-bob"], clerkUpdatedAt: 10 },
			],
		});
		expect(
			(await links(t)).map(({ userId, appleUserIds }) => [
				userId,
				appleUserIds,
			]),
		).toEqual(
			expect.arrayContaining([
				["alice", ["apple-new"]],
				["bob", ["apple-bob"]],
			]),
		);
		const tooMany = Array.from({ length: 101 }, (_, i) => ({
			userId: `user-${i}`,
			appleUserIds: ["apple"],
			clerkUpdatedAt: 1,
		}));
		await expect(
			t.mutation(internal.account.backfillAppleLinks, { links: tooMany }),
		).rejects.toMatchObject({ data: { code: "tooLarge" } });
	});

	it("reads only verified Apple accounts from a Clerk user", () => {
		expect(
			verifiedAppleUserIds({
				external_accounts: [
					{
						provider: "oauth_apple",
						provider_user_id: "a",
						verification: { status: "verified" },
					},
					{
						provider: "apple",
						provider_user_id: "b",
						verification: { status: "verified" },
					},
					{
						provider: "oauth_apple",
						provider_user_id: "a",
						verification: { status: "verified" },
					},
					{
						provider: "oauth_apple",
						provider_user_id: "c",
						verification: { status: "unverified" },
					},
					{
						provider: "oauth_apple",
						provider_user_id: "d",
						verification: null,
					},
					{
						provider: "oauth_google",
						provider_user_id: "e",
						verification: { status: "verified" },
					},
					{
						provider: "oauth_apple",
						provider_user_id: "",
						verification: { status: "verified" },
					},
					null,
				],
			}),
		).toEqual(["a", "b"]);
		expect(verifiedAppleUserIds({})).toEqual([]);
		expect(verifiedAppleUserIds({ external_accounts: "nope" })).toEqual([]);
	});
});
