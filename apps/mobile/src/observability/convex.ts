import * as Sentry from "@sentry/react-native";
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
	if (__DEV__ && process.env.EXPO_PUBLIC_DEBUG_QUERIES === "1")
		logSubscriptions(client);
	return client;
}

/**
 * Development aid (`driver.sh up --debug-queries`): log every watcher start and
 * stop as `[convex-query] +/- name`. Identical watchers share one wire
 * subscription, so a query stays subscribed while any of its watchers is open.
 */
function logSubscriptions(client: ConvexReactClient) {
	const watch = client.watchQuery.bind(client);
	client.watchQuery = (reference, ...args) => {
		const watcher = watch(reference, ...args);
		const name = getFunctionName(reference);
		const onUpdate = watcher.onUpdate.bind(watcher);
		watcher.onUpdate = (callback) => {
			console.log(`[convex-query] + ${name}`);
			const stop = onUpdate(callback);
			return () => {
				console.log(`[convex-query] - ${name}`);
				stop();
			};
		};
		return watcher;
	};
}
