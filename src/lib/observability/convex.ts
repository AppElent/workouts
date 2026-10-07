import * as Sentry from "@sentry/react";
import type { ConvexReactClient } from "convex/react";
import { getFunctionName } from "convex/server";
import { reportError } from "./errors";

/** Instrument the shared client, including writes made through useMutation. */
export function instrumentConvexClient(client: ConvexReactClient) {
	const mutation = client.mutation.bind(client);
	const action = client.action.bind(client);
	client.mutation = (reference, ...args) => {
		const operation = getFunctionName(reference);
		return Sentry.startSpan(
			{ name: operation, op: "convex.mutation" },
			async () => {
				try {
					return await mutation(reference, ...args);
				} catch (error) {
					reportError(error, operation);
					throw error;
				}
			},
		);
	};
	client.action = (reference, ...args) => {
		const operation = getFunctionName(reference);
		return Sentry.startSpan(
			{ name: operation, op: "convex.action" },
			async () => {
				try {
					return await action(reference, ...args);
				} catch (error) {
					reportError(error, operation);
					throw error;
				}
			},
		);
	};
	return client;
}
