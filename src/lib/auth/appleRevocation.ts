import { APPLE_WEB_SERVICES_ID, appleWebReturnUrl } from "@foundry/core";
import { reportError } from "#/lib/observability/errors";

const APPLE_JS =
	"https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js";

/** The slice of Apple JS (`window.AppleID.auth`) this flow uses. */
export type AppleIdAuth = {
	init(config: {
		clientId: string;
		scope: string;
		redirectURI: string;
		state: string;
		usePopup: true;
	}): void;
	signIn(): Promise<{
		authorization: { code?: string; id_token?: string; state?: string };
	}>;
};

type AppleLinkedUser = {
	externalAccounts: readonly { provider: string; providerUserId: string }[];
};

export type RevokeAppleSignIn = (args: {
	authorizationCode: string;
	bundleId: string;
	redirectUri: string;
}) => Promise<unknown>;

let appleJs: Promise<AppleIdAuth> | null = null;

function loadAppleJs(): Promise<AppleIdAuth> {
	appleJs ??= new Promise<AppleIdAuth>((resolve, reject) => {
		const script = document.createElement("script");
		script.src = APPLE_JS;
		script.async = true;
		script.onload = () => {
			const auth = (window as { AppleID?: { auth?: AppleIdAuth } }).AppleID
				?.auth;
			if (auth) resolve(auth);
			else reject(new Error("Apple JS loaded without AppleID.auth"));
		};
		script.onerror = () => {
			appleJs = null;
			reject(new Error("Apple JS could not be loaded"));
		};
		document.head.appendChild(script);
	});
	return appleJs;
}

function appleUserIds(user: AppleLinkedUser) {
	return user.externalAccounts
		.filter(({ provider }) => provider.replace(/^oauth_/, "") === "apple")
		.map(({ providerUserId }) => providerUserId);
}

/** The `sub` of Apple's ID token: the Apple user the popup signed in. */
function idTokenSubject(idToken: string | undefined): string | null {
	const payload = idToken?.split(".")[1];
	if (!payload) return null;
	try {
		const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
		const { sub } = JSON.parse(json) as { sub?: unknown };
		return typeof sub === "string" ? sub : null;
	} catch {
		return null;
	}
}

function isPopupCancel(error: unknown) {
	const code = (error as { error?: unknown } | null)?.error;
	return code === "popup_closed_by_user" || code === "user_cancelled_authorize";
}

/**
 * Revokes the Sign in with Apple grant before the account is deleted, as Apple
 * requires; the web counterpart of the iOS native sheet. An Apple JS popup for
 * the web Services ID supplies a fresh code that Convex exchanges and revokes.
 * Closing the popup cancels the deletion; any other failure is reported and
 * the deletion continues, so Apple never blocks it.
 *
 * The popup signs in whoever owns the browser's Apple Account, which need not
 * be the person linked to this account. A code for anyone else is never sent,
 * so another person's grant is never revoked.
 *
 * Apple shows the popup only for a return URL registered on the Services ID.
 * From any other origin (local, previews, until production is registered) the
 * grant is not revoked, as on Android.
 */
export async function revokeAppleSignIn(
	user: AppleLinkedUser,
	revoke: RevokeAppleSignIn,
	options: {
		origin?: string;
		returnUrls?: readonly string[];
		loadApple?: () => Promise<AppleIdAuth>;
	} = {},
): Promise<"continue" | "cancelled"> {
	const linked = appleUserIds(user);
	if (linked.length === 0) return "continue";
	const redirectUri = appleWebReturnUrl(
		options.origin ?? window.location.origin,
		options.returnUrls,
	);
	if (!redirectUri) return "continue";
	try {
		const apple = await (options.loadApple ?? loadAppleJs)();
		const state = crypto.randomUUID();
		apple.init({
			clientId: APPLE_WEB_SERVICES_ID,
			scope: "",
			redirectURI: redirectUri,
			state,
			usePopup: true,
		});
		const { authorization } = await apple.signIn();
		if (authorization.state !== state)
			throw new Error("Apple popup returned a different state");
		const subject = idTokenSubject(authorization.id_token);
		if (!subject || !linked.includes(subject))
			throw new Error("Apple popup returned a different Apple Account");
		if (!authorization.code)
			throw new Error("Apple returned no authorization code");
		await revoke({
			authorizationCode: authorization.code,
			bundleId: APPLE_WEB_SERVICES_ID,
			redirectUri,
		});
	} catch (error) {
		if (isPopupCancel(error)) return "cancelled";
		reportError(error, "account.revokeAppleSignIn");
	}
	return "continue";
}
