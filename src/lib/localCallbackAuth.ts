export type LocalCallbackAuthRequest =
	| {
			ok: true;
			redirectUri: string;
			state: string;
	  }
	| {
			ok: false;
			message: string;
	  };

export type LocalCallbackAuthOptions = {
	featureName: string;
	missingRequestMessage: string;
	invalidCallbackMessage: string;
	invalidLoopbackMessage: string;
};

export type LocalCallbackTokenRedirectArgs = {
	redirectUri: string;
	state: string;
	token: string;
};

export type LocalCallbackErrorRedirectArgs = {
	redirectUri: string;
	state: string;
	error: string;
	description?: string;
};

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost"]);

export function parseLocalCallbackAuthRequest(
	requestUrl: string,
	options: LocalCallbackAuthOptions,
): LocalCallbackAuthRequest {
	const url = new URL(requestUrl);
	const redirectUri = url.searchParams.get("redirect_uri");
	const state = url.searchParams.get("state");

	if (!redirectUri || !state) {
		return {
			ok: false,
			message: options.missingRequestMessage,
		};
	}

	let callbackUrl: URL;
	try {
		callbackUrl = new URL(redirectUri);
	} catch {
		return {
			ok: false,
			message: options.invalidCallbackMessage,
		};
	}

	if (
		callbackUrl.protocol !== "http:" ||
		!LOOPBACK_HOSTS.has(callbackUrl.hostname)
	) {
		return {
			ok: false,
			message: options.invalidLoopbackMessage,
		};
	}

	return {
		ok: true,
		redirectUri: callbackUrl.toString(),
		state,
	};
}

export function buildLocalCallbackTokenRedirect({
	redirectUri,
	state,
	token,
}: LocalCallbackTokenRedirectArgs): string {
	const url = new URL(redirectUri);
	url.searchParams.set("state", state);
	url.searchParams.set("token", token);
	return url.toString();
}

export function buildLocalCallbackErrorRedirect({
	redirectUri,
	state,
	error,
	description,
}: LocalCallbackErrorRedirectArgs): string {
	const url = new URL(redirectUri);
	url.searchParams.set("state", state);
	url.searchParams.set("error", error);
	if (description) {
		url.searchParams.set("error_description", description);
	}
	return url.toString();
}
