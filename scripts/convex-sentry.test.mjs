import { executionErrorEvent, nextAttempt } from "./convex-sentry.mjs";

const options = { deployment: "fine-akita-444", app: "foundry-convex" };
const failure = {
	kind: "Completion",
	error: "Error: Scheduled job failed for a@b.nl\n    at handler (convex/jobs.ts:12:3)",
	identifier: "jobs:run",
	udfType: "Mutation",
	timestamp: 12345,
	requestId: "request-1",
	executionId: "execution-1",
	logLines: ["private nutrition payload"],
	args: { password: "secret" },
};

it("forwards execution failures with the sanitized stack and structural tags only", () => {
	const result = executionErrorEvent(failure, options);
	expect(result.error.message).toBe("Error: Scheduled job failed for [Filtered]");
	expect(result.error.stack).toContain("convex/jobs.ts:12:3");
	expect(result.tags).toEqual({
		app: "foundry-convex",
		func: "jobs:run",
		func_type: "Mutation",
		request_id: "request-1",
	});
	expect(JSON.stringify(result)).not.toContain("private nutrition payload");
	expect(JSON.stringify(result)).not.toContain("secret");
});

it("ignores console output, successful calls, retried conflicts and malformed records", () => {
	for (const entry of [
		null,
		{},
		{ ...failure, kind: "Progress" },
		{ ...failure, error: null },
		{ ...failure, error: "" },
		{ ...failure, willRetry: true },
	]) {
		expect(executionErrorEvent(entry, options)).toBeNull();
	}
});

it("uses a stable event ID for replayed history and distinct IDs for new executions", () => {
	expect(executionErrorEvent(failure, options).eventId).toBe(
		executionErrorEvent({ ...failure }, options).eventId,
	);
	expect(
		executionErrorEvent({ ...failure, executionId: "execution-2" }, options)
			.eventId,
	).not.toBe(executionErrorEvent(failure, options).eventId);
});

it("reconnects with a capped, doubling backoff", () => {
	expect(nextAttempt({ failedStarts: 1, backoff: 5_000 })).toEqual({
		delay: 5_000,
		backoff: 10_000,
	});
	expect(nextAttempt({ failedStarts: 0, backoff: 60_000 }).backoff).toBe(60_000);
});

it("stops on a Convex auth error and after repeated failed starts", () => {
	expect(nextAttempt({ failedStarts: 1, backoff: 5_000, authError: true })).toEqual({
		stop: "auth",
	});
	expect(nextAttempt({ failedStarts: 5, backoff: 5_000 })).toEqual({
		stop: "failed",
	});
});
