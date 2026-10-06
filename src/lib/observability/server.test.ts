import { vi } from "vitest";

const mocks = vi.hoisted(() => ({
	startFetch: vi.fn(),
	sentryFetch: vi.fn(),
}));

vi.mock("@tanstack/react-start/server-entry", () => ({
	default: { fetch: mocks.startFetch },
}));
vi.mock("@sentry/cloudflare", () => ({
	withSentry: () => ({ fetch: mocks.sentryFetch }),
}));

import server from "../../server";

beforeEach(() => {
	vi.clearAllMocks();
});

it("bypasses Sentry for a local SSR failure despite production bindings", async () => {
	const response = new Response("SSR failure", { status: 500 });
	mocks.startFetch.mockResolvedValue(response);
	const request = new Request("http://localhost:3100/");
	const ctx = {} as ExecutionContext;

	expect(
		await server.fetch(request, { environment_name: "production" }, ctx),
	).toBe(response);
	expect(mocks.startFetch).toHaveBeenCalledWith(request);
	expect(mocks.sentryFetch).not.toHaveBeenCalled();
});

it("retains the Sentry wrapper for deployed requests", async () => {
	const response = new Response("SSR failure", { status: 500 });
	mocks.sentryFetch.mockResolvedValue(response);
	const request = new Request("https://foundry.appelent.nl/");
	const env = { environment_name: "production" };
	const ctx = {} as ExecutionContext;

	expect(await server.fetch(request, env, ctx)).toBe(response);
	expect(mocks.sentryFetch).toHaveBeenCalledWith(request, env, ctx);
	expect(mocks.startFetch).not.toHaveBeenCalled();
});
