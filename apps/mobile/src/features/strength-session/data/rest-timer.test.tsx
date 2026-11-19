import { act, render } from "@testing-library/react-native";
import type { ReactElement } from "react";
import { LocaleProvider } from "../../../i18n";
import {
	accountKeyspace,
	writeLocalJson,
} from "../../../local-store/local-store";
import {
	type RestTimerApi,
	RestTimerProvider,
	useRestState,
	useRestTimer,
} from "./rest-timer";

jest.mock("expo-notifications", () => ({
	setNotificationHandler: jest.fn(),
	getPermissionsAsync: jest.fn().mockResolvedValue({ granted: false }),
	requestPermissionsAsync: jest.fn().mockResolvedValue({ granted: false }),
	scheduleNotificationAsync: jest.fn().mockResolvedValue("id"),
	cancelScheduledNotificationAsync: jest.fn().mockResolvedValue(undefined),
	SchedulableTriggerInputTypes: { TIME_INTERVAL: "timeInterval" },
}));

const key = (subject: string) =>
	accountKeyspace("strength-rest:v1").key(subject);
let subjectCount = 0;
const newSubject = () => `rest-timer-test-${++subjectCount}`;

type Probe = { api: RestTimerApi; state: ReturnType<typeof useRestState> };
async function mount(
	subject: string,
	activeSessionId: string | null | undefined,
) {
	const probe = {} as Probe;
	function Reader() {
		probe.api = useRestTimer();
		probe.state = useRestState();
		return null;
	}
	const tree = (active: string | null | undefined): ReactElement => (
		<LocaleProvider>
			<RestTimerProvider subject={subject} activeSessionId={active}>
				<Reader />
			</RestTimerProvider>
		</LocaleProvider>
	);
	const view = await render(tree(activeSessionId));
	return {
		probe,
		activeIs: (active: string | null | undefined) =>
			view.rerender(tree(active)),
		unmount: () => view.unmount(),
	};
}

it("shows a rest only in the session it began in", async () => {
	const subject = newSubject();
	const { probe, activeIs } = await mount(subject, "session-a");
	await act(async () => probe.api.start("session-a", 90, "Squat"));
	expect(probe.state.running).toBe(true);
	expect(probe.api.current()).not.toBeNull();

	// A is finished elsewhere and B starts before A's rest runs out.
	await activeIs("session-b");
	expect(probe.state.running).toBe(false);
	expect(probe.state.endsAt).toBeNull();
	expect(probe.api.current()).toBeNull();
});

it("clears a stale rest from storage once another session is active", async () => {
	const subject = newSubject();
	const first = await mount(subject, "session-a");
	await act(async () => first.probe.api.start("session-a", 90));
	await first.unmount();

	const second = await mount(subject, "session-b");
	expect(second.probe.state.running).toBe(false);
	expect(second.probe.api.current()).toBeNull();
	// Gone for good, not only hidden: back in A it does not return.
	await second.unmount();
	const third = await mount(subject, "session-a");
	expect(third.probe.state.running).toBe(false);
});

it("keeps a rest across a restart in the same session", async () => {
	const subject = newSubject();
	const first = await mount(subject, "session-a");
	await act(async () => first.probe.api.start("session-a", 90, "Squat"));
	const endsAt = first.probe.state.endsAt;
	await first.unmount();

	const second = await mount(subject, undefined);
	// Hidden while the active session loads, shown once it is the same one.
	expect(second.probe.state.running).toBe(false);
	await second.activeIs("session-a");
	expect(second.probe.state.running).toBe(true);
	expect(second.probe.state.endsAt).toBe(endsAt);
});

it("clears a rest when no session is active", async () => {
	const subject = newSubject();
	const first = await mount(subject, "session-a");
	await act(async () => first.probe.api.start("session-a", 90));
	await first.activeIs(null);
	expect(first.probe.state.running).toBe(false);
});

it("lets the active session adopt a running rest stored before rests had a session", async () => {
	const subject = newSubject();
	const endsAt = Date.now() + 60_000;
	writeLocalJson(key(subject), { endsAt, body: "Squat" });
	const { probe } = await mount(subject, "session-a");
	expect(probe.state.running).toBe(true);
	expect(probe.state.endsAt).toBe(endsAt);
});

it("drops a stored rest from before rests had a session once it has run out", async () => {
	const subject = newSubject();
	writeLocalJson(key(subject), { endsAt: Date.now() - 1000, body: null });
	const { probe } = await mount(subject, "session-a");
	expect(probe.state.running).toBe(false);
});
