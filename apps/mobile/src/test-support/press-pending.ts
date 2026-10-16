import { setImmediate } from "node:timers";
import { fireEvent } from "@testing-library/react-native";
import type { TestInstance } from "test-renderer";

/**
 * Presses an element whose async handler waits on the user, such as a native
 * confirmation. `fireEvent.press` settles only with its handler, so awaiting it
 * would deadlock. This waits for the press's act scope to close, then returns the
 * handler's completion for the test to await after it answers. Node's timer is
 * used because `renderRouter` installs fake global timers.
 */
export async function pressPending(element: TestInstance) {
	const settled = fireEvent.press(element);
	await new Promise((resolve) => setImmediate(resolve));
	return { settled };
}
