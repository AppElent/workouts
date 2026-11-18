import { APPLE_WEB_SERVICES_ID, appleWebReturnUrl } from "@foundry/core";
import { reportError } from "#/lib/observability/errors";

/** Apple JS localises its popup per script URL. */
const APPLE_JS_LOCALES = { en: "en_US", nl: "nl_NL" } as const;
export type AppleJsLocale = keyof typeof APPLE_JS_LOCALES;

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

/**
 * Loads Apple JS once per page. Load it before the person clicks: Safari blocks
 * a popup opened after awaiting a script load, because the click no longer
 * counts as the trigger.
 */
function loadAppleJs(locale: AppleJsLocale): Promise<AppleIdAuth> {
	appleJs ??= new Promise<AppleIdAuth>((resolve, reject) => {
		const script = document.createElement("script");
		script.src = `https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/${APPLE_JS_LOCALES[locale]}/appleid.auth.js`;
		script.async = true;
		script.onload = () => {
			const auth = (window as { AppleID?: { auth?: AppleIdAuth } }).AppleID
				?.auth;
			if (auth) return resolve(auth);
			appleJs = null;
			reject(new Error("Apple JS loaded without AppleID.auth"));
		};
		script.onerror = () => {
			appleJs = null;
			reject(new Error("Apple JS could not be loaded"));
		};
		document.head.appendChild(script);
	});
	return appleJs;
}

/**
 * The return URL to revoke with, when this account is Apple-linked and this
 * origin is registered with Apple; otherwise web revocation is skipped.
 */
export function appleRevocationReturnUrl(
	user: AppleLinkedUser,
	origin: string = window.location.origin,
	returnUrls?: readonly string[],
): string | null {
	return appleUserIds(user).length > 0
		? appleWebReturnUrl(origin, returnUrls)
		: null;
}

/** Starts loading Apple JS when Delete account may need it. */
export function preloadAppleJs(user: AppleLinkedUser, locale: AppleJsLocale) {
	if (appleRevocationReturnUrl(user))
		loadAppleJs(locale).catch(() => {
			// Reported when the deletion actually needs it.
		});
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

function popupError(error: unknown) {
	return (error as { error?: unknown } | null)?.error;
}

/**
 * Revokes the Sign in with Apple grant before the account is deleted, as Apple
 * requires; the web counterpart of the iOS native sheet. An Apple JS popup for
 * the web Services ID supplies a fresh code that Convex exchanges and revokes.
 * Closing the popup cancels the deletion, and a blocked popup stops it so the
 * person can allow pop-ups and retry; any other failure is reported and the
 * deletion continues, so Apple never blocks it.
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
		locale?: AppleJsLocale;
		origin?: string;
		returnUrls?: readonly string[];
		loadApple?: () => Promise<AppleIdAuth>;
	} = {},
): Promise<"continue" | "cancelled" | "popupBlocked"> {
	const redirectUri = appleRevocationReturnUrl(
		user,
		options.origin,
		options.returnUrls,
	);
	if (!redirectUri) return "continue";
	const linked = appleUserIds(user);
	try {
		const apple = await (
			options.loadApple ?? (() => loadAppleJs(options.locale ?? "en"))
		)();
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
		const code = popupError(error);
		if (code === "popup_closed_by_user" || code === "user_cancelled_authorize")
			return "cancelled";
		if (code === "popup_blocked_by_browser") return "popupBlocked";
		reportError(error, "account.revokeAppleSignIn");
	}
	return "continue";
}
