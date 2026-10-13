import { act } from "@testing-library/react-native";
import { ACTION_ARM_MS } from "../ui/toast";

/**
 * Lets the toast's arming delay pass so a test can tap its action. Route tests
 * run on `renderRouter`'s fake timers, so the clock is advanced, not waited on.
 */
export async function armToastAction() {
	await act(async () => {
		jest.advanceTimersByTime(ACTION_ARM_MS);
	});
}
