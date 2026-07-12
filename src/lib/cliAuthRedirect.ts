export type CliAuthRequest =
	| {
			ok: true;
			redirectUri: string;
			state: string;
	  }
	| {
			ok: false;
			message: string;
	  };

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost"]);

export function parseCliAuthRequest(requestUrl: string): CliAuthRequest {
	const url = new URL(requestUrl);
	const redirectUri = url.searchParams.get("redirect_uri");
	const state = url.searchParams.get("state");

	if (!redirectUri || !state) {
		return {
			ok: false,
			message: "CLI login request is missing redirect_uri or state.",
		};
	}

	let callbackUrl: URL;
	try {
		callbackUrl = new URL(redirectUri);
	} catch {
		return {
			ok: false,
			message: "CLI callback URL is invalid.",
		};
	}

	if (
		callbackUrl.protocol !== "http:" ||
		!LOOPBACK_HOSTS.has(callbackUrl.hostname)
	) {
		return {
			ok: false,
			message:
				"CLI callback URL must be a local http://127.0.0.1 or http://localhost URL.",
		};
	}

	return {
		ok: true,
		redirectUri: callbackUrl.toString(),
		state,
	};
}

export function buildCliAuthTokenRedirect({
	redirectUri,
	state,
	token,
}: {
	redirectUri: string;
	state: string;
	token: string;
}): string {
	const url = new URL(redirectUri);
	url.searchParams.set("state", state);
	url.searchParams.set("token", token);
	return url.toString();
}

export function buildCliAuthErrorRedirect({
	redirectUri,
	state,
	error,
	description,
}: {
	redirectUri: string;
	state: string;
	error: string;
	description?: string;
}): string {
	const url = new URL(redirectUri);
	url.searchParams.set("state", state);
	url.searchParams.set("error", error);
	if (description) {
		url.searchParams.set("error_description", description);
	}
	return url.toString();
}
