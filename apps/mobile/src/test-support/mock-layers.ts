/**
 * Fixture transports wrap the Convex hook mocks. Mock implementations outlive
 * a test, so each wrapper records what it wrapped and for which render: a new
 * render's transports wrap the test's own mocks, not an earlier render's
 * fixture servers.
 */
const wrapped = new WeakMap<object, { original: unknown; render: number }>();
let render = 0;

/** Starts a render: wrappers from earlier renders are skipped from now on. */
export function startMockLayers() {
	render += 1;
}

export function underlying<T>(implementation: T | undefined): T | undefined {
	let current: unknown = implementation;
	while (typeof current === "function") {
		const layer = wrapped.get(current);
		if (!layer || layer.render === render) break;
		current = layer.original;
	}
	return current as T | undefined;
}

export function wrapping<T extends object>(
	implementation: T,
	original: unknown,
): T {
	wrapped.set(implementation, { original, render });
	return implementation;
}
