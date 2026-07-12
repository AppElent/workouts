import { describe, expect, it } from "vitest";
import {
	buildCliAuthErrorRedirect,
	buildCliAuthTokenRedirect,
	parseCliAuthRequest,
} from "./cliAuthRedirect";

describe("CLI auth redirect helpers", () => {
	it("accepts loopback callback URLs with state", () => {
		const request = parseCliAuthRequest(
			"http://localhost:3000/api/cli/auth/login?redirect_uri=http%3A%2F%2F127.0.0.1%3A54321%2Fcallback&state=abc",
		);

		expect(request).toEqual({
			ok: true,
			redirectUri: "http://127.0.0.1:54321/callback",
			state: "abc",
		});
	});

	it("rejects non-loopback callback URLs", () => {
		const request = parseCliAuthRequest(
			"http://localhost:3000/api/cli/auth/login?redirect_uri=https%3A%2F%2Fevil.example%2Fcallback&state=abc",
		);

		expect(request).toEqual({
			ok: false,
			message:
				"CLI callback URL must be a local http://127.0.0.1 or http://localhost URL.",
		});
	});

	it("builds token and error callback URLs with the original state", () => {
		expect(
			buildCliAuthTokenRedirect({
				redirectUri: "http://127.0.0.1:54321/callback",
				state: "abc",
				token: "token",
			}),
		).toBe("http://127.0.0.1:54321/callback?state=abc&token=token");

		expect(
			buildCliAuthErrorRedirect({
				redirectUri: "http://127.0.0.1:54321/callback",
				state: "abc",
				error: "access_denied",
				description: "Could not create a token.",
			}),
		).toBe(
			"http://127.0.0.1:54321/callback?state=abc&error=access_denied&error_description=Could+not+create+a+token.",
		);
	});
});
