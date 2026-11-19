import * as Sentry from "@sentry/react-native";
import { act, render } from "@testing-library/react-native";
import { Text } from "react-native";
import { Modal } from "../ui/modal";
import {
	DISMISS_SETTLE_MS,
	isPresentedRoute,
	resetShakeToReportForTests,
	startShakeToReport,
	useShakeToReportBlocker,
} from "./shake-to-report";

function Blocker({ active }: { active: boolean }) {
	useShakeToReportBlocker(active);
	return null;
}

const settle = () =>
	act(() => {
		jest.advanceTimersByTime(DISMISS_SETTLE_MS);
	});

beforeEach(() => {
	jest.useFakeTimers();
	resetShakeToReportForTests();
	jest.mocked(Sentry.enableFeedbackOnShake).mockClear();
	jest.mocked(Sentry.disableFeedbackOnShake).mockClear();
});

afterEach(() => {
	jest.useRealTimers();
});

it("listens for shakes once started with nothing presented", () => {
	startShakeToReport();
	expect(Sentry.enableFeedbackOnShake).toHaveBeenCalledTimes(1);
});

it("pauses while a sheet is presented and resumes after the last one closes", async () => {
	startShakeToReport();
	const view = await render(
		<>
			<Blocker active />
			<Blocker active />
		</>,
	);
	expect(Sentry.disableFeedbackOnShake).toHaveBeenCalledTimes(1);

	await view.rerender(
		<>
			<Blocker active />
			<Blocker active={false} />
		</>,
	);
	await settle();
	expect(Sentry.enableFeedbackOnShake).toHaveBeenCalledTimes(1);
	expect(Sentry.disableFeedbackOnShake).toHaveBeenCalledTimes(1);

	await view.rerender(
		<>
			<Blocker active={false} />
			<Blocker active={false} />
		</>,
	);
	// Still paused while the last sheet animates out.
	expect(Sentry.enableFeedbackOnShake).toHaveBeenCalledTimes(1);
	await settle();
	expect(Sentry.enableFeedbackOnShake).toHaveBeenCalledTimes(2);
});

it("never starts listening under a sheet that opened before start", async () => {
	await render(<Blocker active />);
	startShakeToReport();
	expect(Sentry.enableFeedbackOnShake).not.toHaveBeenCalled();
});

it("treats a visible Modal as presented and a hidden one as not", async () => {
	startShakeToReport();
	const view = await render(
		<Modal visible={false}>
			<Text>Sheet</Text>
		</Modal>,
	);
	expect(Sentry.disableFeedbackOnShake).not.toHaveBeenCalled();

	await view.rerender(
		<Modal visible>
			<Text>Sheet</Text>
		</Modal>,
	);
	expect(Sentry.disableFeedbackOnShake).toHaveBeenCalledTimes(1);

	await view.unmount();
	await settle();
	expect(Sentry.enableFeedbackOnShake).toHaveBeenCalledTimes(2);
});

it("counts sheets and modals as presented routes, plain pushes as not", () => {
	expect(isPresentedRoute("formSheet")).toBe(true);
	expect(isPresentedRoute("modal")).toBe(true);
	expect(isPresentedRoute("card")).toBe(false);
	expect(isPresentedRoute(undefined)).toBe(false);
});

it("treats a presented route in the stack as a blocker", async () => {
	startShakeToReport();
	const routes = [{ presentation: undefined }, { presentation: "formSheet" }];
	const view = await render(
		<Blocker active={routes.some((r) => isPresentedRoute(r.presentation))} />,
	);
	expect(Sentry.disableFeedbackOnShake).toHaveBeenCalledTimes(1);
	await view.unmount();
	await settle();
	expect(Sentry.enableFeedbackOnShake).toHaveBeenCalledTimes(2);
});
