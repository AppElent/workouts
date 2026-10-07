import { executionErrorEvent } from "./convex-sentry-events.mjs";

const options = { environment: "production", deployment: "fine-akita-444" };
const failure = {
	kind: "Completion", error: "Error: Scheduled job failed\n    at handler (convex/jobs.ts:12:3)",
	identifier: "jobs:run", udfType: "Mutation", timestamp: 12345,
	requestId: "request-1", executionId: "execution-1",
	logLines: ["private nutrition payload"], args: { password: "secret" },
};

it("forwards execution failures with the server stack and structural tags only", () => {
	const result = executionErrorEvent(failure, options);
	expect(result.error.stack).toBe(failure.error);
	expect(result.tags).toEqual({ app: "foundry-convex", func: "jobs:run", func_type: "Mutation", server_name: "fine-akita-444", environment: "production", request_id: "request-1" });
	expect(JSON.stringify(result)).not.toContain("private nutrition payload");
	expect(JSON.stringify(result)).not.toContain("secret");
});

it("ignores console output, successful calls, and malformed records", () => {
	for (const entry of [null, {}, { ...failure, kind: "Progress" }, { ...failure, error: null }, { ...failure, error: "" }]) {
		expect(executionErrorEvent(entry, options)).toBeNull();
	}
});

it("uses a stable event ID for replayed history and distinct IDs for new executions", () => {
	expect(executionErrorEvent(failure, options).eventId).toBe(executionErrorEvent({ ...failure }, options).eventId);
	expect(executionErrorEvent({ ...failure, executionId: "execution-2" }, options).eventId).not.toBe(executionErrorEvent(failure, options).eventId);
});
