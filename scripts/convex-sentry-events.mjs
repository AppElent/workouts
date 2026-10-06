import { createHash } from "node:crypto";

export function executionErrorEvent(entry, { environment, deployment }) {
	if (entry?.kind !== "Completion" || typeof entry.error !== "string" || !entry.error) return null;
	if (typeof entry.identifier !== "string" || typeof entry.timestamp !== "number") return null;
	const error = new Error(entry.error.split("\n")[0]);
	error.stack = entry.error;
	const eventId = createHash("sha256")
		.update(JSON.stringify([deployment, entry.requestId, entry.executionId, entry.identifier, entry.timestamp]))
		.digest("hex").slice(0, 32);
	return {
		error,
		eventId,
		timestamp: entry.timestamp,
		tags: {
			app: "foundry-convex",
			func: entry.identifier,
			func_type: String(entry.udfType || "unknown"),
			server_name: deployment,
			environment,
			...(typeof entry.requestId === "string" ? { request_id: entry.requestId } : {}),
		},
	};
}
