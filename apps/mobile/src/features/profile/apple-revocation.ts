import type { ConvexReactClient } from "convex/react";
import * as AppleAuthentication from "expo-apple-authentication";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { api } from "../../convex/api";
import { reportError } from "../../observability/errors";

type AppleLinkedUser = {
	externalAccounts: readonly { provider: string; providerUserId: string }[];
};

/** Apple's stable user identifiers linked to this account. */
function appleUserIds(user: AppleLinkedUser) {
	return user.externalAccounts
		.filter(({ provider }) => provider.replace(/^oauth_/, "") === "apple")
		.map(({ providerUserId }) => providerUserId);
}

/**
 * Revokes the Sign in with Apple grant before the account is deleted, as Apple
 * requires. A fresh native sheet supplies the code Convex exchanges and
 * revokes. Backing out of the sheet cancels the deletion; any other failure is
 * reported and the deletion continues, so Apple never blocks it.
 *
 * The sheet signs in whoever owns the device's Apple Account, which need not
 * be the person linked to this account. A code for anyone else is never sent,
 * so another person's grant is never revoked.
 *
 * Apple issues the code to this build's bundle ID, which differs per install
 * variant, so Convex is told which one to revoke against.
 *
 * Only iOS has the native sheet. Android Apple sign-in goes through Clerk's
 * browser flow, whose tokens the app cannot reach (issue #125).
 */
export async function revokeAppleSignIn(
	user: AppleLinkedUser,
	convex: Pick<ConvexReactClient, "action">,
): Promise<"continue" | "cancelled"> {
	const linked = appleUserIds(user);
	if (Platform.OS !== "ios" || linked.length === 0) return "continue";
	try {
		const credential = await AppleAuthentication.signInAsync();
		if (!linked.includes(credential.user))
			throw new Error("Apple sheet returned a different Apple Account");
		const { authorizationCode } = credential;
		if (!authorizationCode)
			throw new Error("Apple returned no authorization code");
		await convex.action(api.account.revokeAppleSignIn, {
			authorizationCode,
			bundleId: Constants.expoConfig?.ios?.bundleIdentifier,
		});
	} catch (error) {
		if ((error as { code?: string } | null)?.code === "ERR_REQUEST_CANCELED")
			return "cancelled";
		reportError(error, "account.revokeAppleSignIn");
	}
	return "continue";
}
