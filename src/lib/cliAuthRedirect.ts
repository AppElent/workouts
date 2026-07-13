import {
	buildLocalCallbackErrorRedirect,
	buildLocalCallbackTokenRedirect,
	parseLocalCallbackAuthRequest,
	type LocalCallbackAuthRequest,
} from "./localCallbackAuth";

export type CliAuthRequest = LocalCallbackAuthRequest;

export function parseCliAuthRequest(requestUrl: string): CliAuthRequest {
	return parseLocalCallbackAuthRequest(requestUrl, {
		featureName: "CLI",
		missingRequestMessage: "CLI login request is missing redirect_uri or state.",
		invalidCallbackMessage: "CLI callback URL is invalid.",
		invalidLoopbackMessage:
			"CLI callback URL must be a local http://127.0.0.1 or http://localhost URL.",
	});
}

export const buildCliAuthTokenRedirect = buildLocalCallbackTokenRedirect;
export const buildCliAuthErrorRedirect = buildLocalCallbackErrorRedirect;
