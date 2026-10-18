/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "./_generated/api";
import { APPLE_CLIENT_ID, clientSecret } from "./lib/appleSignIn";
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

function appleResponses(
	responses: Record<string, Response>,
): { calls: { path: string; form: URLSearchParams }[] } {
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
			sub: APPLE_CLIENT_ID,
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
			t.action(api.account.revokeAppleSignIn, { authorizationCode: "code" }),
		).rejects.toThrow("unauthenticated");
	});

	it("reports missing Apple credentials instead of calling Apple", async () => {
		const { calls } = appleResponses({});
		const alice = convexTest(schema, modules).withIdentity({ subject: "alice" });
		await expect(
			alice.action(api.account.revokeAppleSignIn, { authorizationCode: "code" }),
		).rejects.toThrow("unavailable");
		expect(calls).toEqual([]);
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
		const alice = convexTest(schema, modules).withIdentity({ subject: "alice" });
		await alice.action(api.account.revokeAppleSignIn, {
			authorizationCode: "code",
		});
		expect(calls.map(({ path }) => path)).toEqual([
			"/auth/token",
			"/auth/revoke",
		]);
		const [exchange, revoke] = calls.map(({ form }) =>
			Object.fromEntries(form),
		);
		expect(exchange).toMatchObject({
			client_id: APPLE_CLIENT_ID,
			code: "code",
			grant_type: "authorization_code",
		});
		expect(revoke).toMatchObject({
			client_id: APPLE_CLIENT_ID,
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
		const alice = convexTest(schema, modules).withIdentity({ subject: "alice" });
		await expect(
			alice.action(api.account.revokeAppleSignIn, { authorizationCode: "code" }),
		).rejects.toThrow("failed");
		expect(calls.map(({ path }) => path)).toEqual(["/auth/token"]);
	});
});
