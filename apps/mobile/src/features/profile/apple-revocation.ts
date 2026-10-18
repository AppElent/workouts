import type { ConvexReactClient } from "convex/react";
import * as AppleAuthentication from "expo-apple-authentication";
import { Platform } from "react-native";
import { api } from "../../convex/api";
import { reportError } from "../../observability/errors";

type AppleLinkedUser = {
	externalAccounts: readonly { provider: string }[];
};

export function usesAppleSignIn(user: AppleLinkedUser) {
	return user.externalAccounts.some(
		({ provider }) => provider.replace(/^oauth_/, "") === "apple",
	);
}

/**
 * Revokes the Sign in with Apple grant before the account is deleted, as Apple
 * requires. A fresh native sheet supplies the code Convex exchanges and
 * revokes. Backing out of the sheet cancels the deletion; any other failure is
 * reported and the deletion continues, so Apple never blocks it.
 *
 * Only iOS has the native sheet. Android Apple sign-in goes through Clerk's
 * browser flow, whose tokens the app cannot reach (issue #125).
 */
export async function revokeAppleSignIn(
	user: AppleLinkedUser,
	convex: Pick<ConvexReactClient, "action">,
): Promise<"continue" | "cancelled"> {
	if (Platform.OS !== "ios" || !usesAppleSignIn(user)) return "continue";
	try {
		const { authorizationCode } = await AppleAuthentication.signInAsync();
		if (!authorizationCode)
			throw new Error("Apple returned no authorization code");
		await convex.action(api.account.revokeAppleSignIn, { authorizationCode });
	} catch (error) {
		if ((error as { code?: string } | null)?.code === "ERR_REQUEST_CANCELED")
			return "cancelled";
		reportError(error, "account.revokeAppleSignIn");
	}
	return "continue";
}
