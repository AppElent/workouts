import {
	buildLocalCallbackErrorRedirect,
	buildLocalCallbackTokenRedirect,
	type LocalCallbackAuthRequest,
	parseLocalCallbackAuthRequest,
} from "./localCallbackAuth";

export type McpAuthRequest = LocalCallbackAuthRequest;

export function parseMcpAuthRequest(requestUrl: string): McpAuthRequest {
	return parseLocalCallbackAuthRequest(requestUrl, {
		featureName: "MCP",
		missingRequestMessage:
			"MCP login request is missing redirect_uri or state.",
		invalidCallbackMessage: "MCP callback URL is invalid.",
		invalidLoopbackMessage:
			"MCP callback URL must be a local http://127.0.0.1 or http://localhost URL.",
	});
}

export const buildMcpAuthTokenRedirect = buildLocalCallbackTokenRedirect;
export const buildMcpAuthErrorRedirect = buildLocalCallbackErrorRedirect;
