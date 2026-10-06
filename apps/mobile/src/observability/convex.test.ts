import * as Sentry from "@sentry/react-native";
import type { ConvexReactClient } from "convex/react";
import { makeFunctionReference } from "convex/server";
import { instrumentConvexClient } from "./convex";
import { reportError } from "./errors";

beforeEach(() => jest.clearAllMocks());

it("preserves successful mutation results without sending payloads to Sentry", async () => {
	const mutation = jest.fn().mockResolvedValue("receipt");
	const client = instrumentConvexClient({
		mutation,
		action: jest.fn(),
	} as unknown as ConvexReactClient);
	const reference = makeFunctionReference<"mutation">("sets:log");
	const args = { weight: 80, notes: "private" };
	expect(await client.mutation(reference, args)).toBe("receipt");
	expect(mutation).toHaveBeenCalledWith(reference, args);
	expect(Sentry.startSpan).toHaveBeenCalledWith(
		{ name: "sets:log", op: "convex.mutation" },
		expect.any(Function),
	);
	expect(Sentry.captureException).not.toHaveBeenCalled();
});

it.each([
	"mutation",
	"action",
] as const)("reports %s failures and rethrows the original error for existing UI recovery", async (kind) => {
	const error = new Error("Server unavailable");
	const failed = jest.fn().mockRejectedValue(error);
	const client = instrumentConvexClient({
		mutation: failed,
		action: failed,
	} as unknown as ConvexReactClient);
	const promise =
		kind === "mutation"
			? client.mutation(
					makeFunctionReference<"mutation">("nutritionDiary:apply"),
					{},
				)
			: client.action(
					makeFunctionReference<"action">("nutritionDiary:apply"),
					{},
				);
	await expect(promise).rejects.toBe(error);
	expect(Sentry.captureException).toHaveBeenCalledWith(error, {
		tags: { operation: "nutritionDiary:apply", handled: true },
	});
	reportError(error, "route.render");
	expect(Sentry.captureException).toHaveBeenCalledTimes(1);
});
