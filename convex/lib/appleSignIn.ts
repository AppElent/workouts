/**
 * Revokes a user's Sign in with Apple grant, which Apple requires when an
 * account that used it is deleted (TN3194). Clerk does not do this on user
 * deletion, so the app does it itself before deleting the Clerk user.
 *
 * The iOS app hands over a fresh `authorizationCode` from the native sheet. It
 * is exchanged for a refresh token, which is then revoked. Native codes are
 * issued to the bundle ID, so that is the `client_id`.
 */

const APPLE = "https://appleid.apple.com";
export const APPLE_CLIENT_IDS = [
	"com.appelent.foundry",
	"com.appelent.foundry.preview",
	"com.appelent.foundry.dev",
] as const;
export type AppleClientId = (typeof APPLE_CLIENT_IDS)[number];

export function isAppleClientId(value: string): value is AppleClientId {
	return (APPLE_CLIENT_IDS as readonly string[]).includes(value);
}
/** Apple accepts client secrets valid for up to six months; one use needs minutes. */
const SECRET_LIFETIME_SECONDS = 300;

export type AppleCredentials = {
	readonly teamId: string;
	readonly keyId: string;
	/** The `.p8` key, with or without PEM armour; escaped `\n` is accepted. */
	readonly privateKey: string;
};

export function appleCredentials(): AppleCredentials | null {
	const teamId = process.env.APPLE_TEAM_ID;
	const keyId = process.env.APPLE_SIGN_IN_KEY_ID;
	const privateKey = process.env.APPLE_SIGN_IN_PRIVATE_KEY;
	return teamId && keyId && privateKey ? { teamId, keyId, privateKey } : null;
}

function base64Url(bytes: Uint8Array | string) {
	const binary =
		typeof bytes === "string"
			? bytes
			: Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
	return btoa(binary)
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");
}

function pkcs8(privateKey: string) {
	const body = privateKey
		.replace(/\\n/g, "\n")
		.replace(/-----(BEGIN|END) PRIVATE KEY-----/g, "")
		.replace(/\s+/g, "");
	return Uint8Array.from(atob(body), (char) => char.charCodeAt(0));
}

/** ES256 JWT that authenticates Foundry to Apple's token endpoints. */
export async function clientSecret(
	credentials: AppleCredentials,
	clientId: AppleClientId,
	now = Date.now(),
) {
	const issuedAt = Math.floor(now / 1000);
	const header = base64Url(
		JSON.stringify({ alg: "ES256", kid: credentials.keyId }),
	);
	const claims = base64Url(
		JSON.stringify({
			iss: credentials.teamId,
			iat: issuedAt,
			exp: issuedAt + SECRET_LIFETIME_SECONDS,
			aud: APPLE,
			sub: clientId,
		}),
	);
	const key = await crypto.subtle.importKey(
		"pkcs8",
		pkcs8(credentials.privateKey),
		{ name: "ECDSA", namedCurve: "P-256" },
		false,
		["sign"],
	);
	// Web Crypto returns the raw r‖s signature JWS expects.
	const signature = await crypto.subtle.sign(
		{ name: "ECDSA", hash: "SHA-256" },
		key,
		new TextEncoder().encode(`${header}.${claims}`),
	);
	return `${header}.${claims}.${base64Url(new Uint8Array(signature))}`;
}

async function post(path: string, form: Record<string, string>) {
	const response = await fetch(`${APPLE}${path}`, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams(form),
	});
	if (!response.ok) {
		// Apple's error body is a short code such as `invalid_grant`, never a token.
		throw new Error(
			`Apple ${path} returned ${response.status}: ${await response.text()}`,
		);
	}
	return response;
}

export async function revokeAppleAuthorization(
	credentials: AppleCredentials,
	authorizationCode: string,
	clientId: AppleClientId,
) {
	const secret = await clientSecret(credentials, clientId);
	const tokens = (await (
		await post("/auth/token", {
			client_id: clientId,
			client_secret: secret,
			code: authorizationCode,
			grant_type: "authorization_code",
		})
	).json()) as { refresh_token?: string; access_token?: string };
	const [token, hint] = tokens.refresh_token
		? [tokens.refresh_token, "refresh_token"]
		: [tokens.access_token, "access_token"];
	if (!token) throw new Error("Apple /auth/token returned no token");
	await post("/auth/revoke", {
		client_id: clientId,
		client_secret: secret,
		token,
		token_type_hint: hint,
	});
}
