import { useConvexConnectionState, useMutation, useQuery } from "convex/react";
import { getFunctionName } from "convex/server";
import { router, Stack, useRouter } from "expo-router";
import {
	act,
	cleanup,
	fireEvent,
	renderRouter,
	screen,
	waitFor,
} from "expo-router/testing-library";
import { Pressable } from "react-native";
import * as DetailRoute from "../../app/(app)/endurance/[id]";
import * as EditorRoute from "../../app/(app)/endurance-editor";
import { LocaleProvider } from "../i18n";
import { NativeAlertHost } from "../test-support/native-alert-host";
import { AppearanceProvider } from "../theme";
import { ConfirmProvider } from "../ui/confirm-dialog";
import { AppText } from "../ui/text";
import { ToastProvider } from "../ui/toast";

// Expo Router's native prevent-remove provider mutates its parent during
// react-test-renderer effect cleanup. The router still dispatches the real
// beforeRemove action here; this adapter tests the screen's decision without
// that renderer-only provider warning.
jest.mock("expo-router/build/react-navigation/core", () => ({
	...jest.requireActual("expo-router/build/react-navigation/core"),
	usePreventRemove: (
		preventRemove: boolean,
		callback: (event: { data: { action: unknown } }) => void,
	) => {
		const React = require("react") as typeof import("react");
		const { useNavigation } =
			require("expo-router") as typeof import("expo-router");
		const navigation = useNavigation();
		React.useEffect(
			() =>
				navigation.addListener("beforeRemove", (event) => {
					if (!preventRemove) return;
					event.preventDefault();
					callback({ data: event.data });
				}),
			[navigation, preventRemove, callback],
		);
	},
}));

const mockUseMutation = jest.mocked(useMutation);
const mockUseQuery = jest.mocked(useQuery);
const mockUseConnectionState = jest.mocked(useConvexConnectionState);

afterEach(() => {
	act(() => cleanup());
});

const saved = {
	id: "run-1",
	sport: "running" as const,
	occurredAt: new Date(2026, 8, 20, 8, 30).getTime(),
	durationSeconds: 1800,
	distanceMeters: 5000,
	title: "Morning run",
	notes: "Easy",
	environment: "outdoor" as const,
	elevationGainMeters: 32,
	averageHeartRate: 140,
	effort: 5,
	createdAt: 1,
	updatedAt: 1,
};

function Layout() {
	return (
		<AppearanceProvider>
			<LocaleProvider>
				<NativeAlertHost>
					<ToastProvider>
						<ConfirmProvider>
							<Stack />
						</ConfirmProvider>
					</ToastProvider>
				</NativeAlertHost>
			</LocaleProvider>
		</AppearanceProvider>
	);
}

function Home() {
	const router = useRouter();
	return (
		<Pressable onPress={() => router.push("/endurance-editor?sport=running")}>
			<AppText>Open editor</AppText>
		</Pressable>
	);
}

function History() {
	return <AppText>Activity history</AppText>;
}

function renderEditor(path = "/endurance-editor?sport=running") {
	return renderRouter(
		{
			_layout: Layout,
			index: Home,
			"activity-history": History,
			"endurance-editor": EditorRoute,
			"endurance/[id]": DetailRoute,
		},
		{ initialUrl: path },
	);
}

function mockMutations(impl: Record<string, jest.Mock>) {
	mockUseMutation.mockImplementation(
		(reference) =>
			(impl[getFunctionName(reference)] ??
				jest.fn().mockResolvedValue(null)) as unknown as ReturnType<
				typeof useMutation
			>,
	);
}

async function pressAndFlush(label: string) {
	await act(async () => {
		fireEvent.press(screen.getByText(label));
	});
}

beforeEach(() => {
	mockUseQuery.mockReturnValue(null);
	mockUseConnectionState.mockReturnValue({
		isWebSocketConnected: true,
	} as ReturnType<typeof useConvexConnectionState>);
	mockMutations({});
});

describe("endurance editor", () => {
	it("keeps entered values after a failed save and permits retry", async () => {
		const create = jest
			.fn()
			.mockRejectedValueOnce(new Error("offline"))
			.mockResolvedValue("run-1");
		mockMutations({ "enduranceActivities:create": create });
		renderEditor();
		fireEvent.changeText(screen.getByLabelText("Distance"), "5.2");
		fireEvent.changeText(screen.getByLabelText("Minutes"), "30");
		fireEvent.press(screen.getByText("Save activity"));
		expect(await screen.findByText("offline")).toBeTruthy();
		expect(screen.getByLabelText("Distance").props.value).toBe("5.2");
		await pressAndFlush("Save activity");
		await waitFor(() => expect(create).toHaveBeenCalledTimes(2));
		expect(create.mock.calls[0][0].clientEntryId).toBe(
			create.mock.calls[1][0].clientEntryId,
		);
	});

	it("reports offline save without queuing a mutation or clearing input", async () => {
		const create = jest.fn();
		mockUseConnectionState.mockReturnValue({
			isWebSocketConnected: false,
		} as ReturnType<typeof useConvexConnectionState>);
		mockMutations({ "enduranceActivities:create": create });
		renderEditor();
		fireEvent.changeText(screen.getByLabelText("Distance"), "5");
		fireEvent.changeText(screen.getByLabelText("Minutes"), "30");
		fireEvent.press(screen.getByText("Save activity"));
		expect(
			await screen.findByText(
				"Connect to save this activity. Your input is still here.",
			),
		).toBeTruthy();
		expect(create).not.toHaveBeenCalled();
		expect(screen.getByLabelText("Distance").props.value).toBe("5");
	});

	it("opens the date picker from the grouped date row", async () => {
		renderEditor();
		fireEvent.press(screen.getByLabelText("Date"));
		expect(await screen.findByText("Today")).toBeTruthy();
	});

	it("blocks duplicate taps while saving", async () => {
		let resolveSave!: (id: string) => void;
		const create = jest.fn(
			() =>
				new Promise<string>((resolve) => {
					resolveSave = resolve;
				}),
		);
		mockMutations({ "enduranceActivities:create": create });
		renderEditor();
		fireEvent.changeText(screen.getByLabelText("Distance"), "5");
		fireEvent.changeText(screen.getByLabelText("Minutes"), "30");
		const button = screen.getByText("Save activity");
		fireEvent.press(button);
		fireEvent.press(button);
		await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
		await act(async () => resolveSave("run-1"));
	});

	it("blocks Back while a save is in flight", async () => {
		let resolveSave!: (id: string) => void;
		const create = jest.fn(
			() =>
				new Promise<string>((resolve) => {
					resolveSave = resolve;
				}),
		);
		mockMutations({ "enduranceActivities:create": create });
		renderEditor("/");
		fireEvent.press(screen.getByText("Open editor"));
		fireEvent.changeText(screen.getByLabelText("Distance"), "5");
		fireEvent.changeText(screen.getByLabelText("Minutes"), "30");
		fireEvent.press(screen.getByText("Save activity"));
		act(() => router.back());
		expect(screen.getByLabelText("Distance").props.value).toBe("5");
		expect(screen.queryByText("Discard changes?")).toBeNull();
		await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
		await act(async () => resolveSave("run-1"));
	});

	it("resolves an uncertain first save before applying changed values", async () => {
		const create = jest
			.fn()
			.mockRejectedValueOnce(new Error("offline"))
			.mockResolvedValue("run-1");
		const update = jest.fn().mockResolvedValue(null);
		mockMutations({
			"enduranceActivities:create": create,
			"enduranceActivities:update": update,
		});
		renderEditor();
		fireEvent.changeText(screen.getByLabelText("Distance"), "5");
		fireEvent.changeText(screen.getByLabelText("Minutes"), "30");
		fireEvent.press(screen.getByText("Save activity"));
		await screen.findByText("offline");
		fireEvent.changeText(screen.getByLabelText("Distance"), "6");
		await pressAndFlush("Save activity");
		await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
		expect(create.mock.calls[0][0]).toEqual(create.mock.calls[1][0]);
		expect(update.mock.calls[0][0]).toMatchObject({
			id: "run-1",
			distanceMeters: 6000,
		});
	});

	it("retries an uncertain update using the already resolved activity ID", async () => {
		const create = jest
			.fn()
			.mockRejectedValueOnce(new Error("offline"))
			.mockResolvedValue("run-1");
		const update = jest
			.fn()
			.mockRejectedValueOnce(new Error("offline"))
			.mockResolvedValue(null);
		mockMutations({
			"enduranceActivities:create": create,
			"enduranceActivities:update": update,
		});
		renderEditor();
		fireEvent.changeText(screen.getByLabelText("Distance"), "5");
		fireEvent.changeText(screen.getByLabelText("Minutes"), "30");
		fireEvent.press(screen.getByText("Save activity"));
		await screen.findByText("offline");
		fireEvent.changeText(screen.getByLabelText("Distance"), "6");
		fireEvent.press(screen.getByText("Save activity"));
		await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
		await waitFor(() =>
			expect(
				screen.getByLabelText("Save activity").props.accessibilityState.busy,
			).toBe(false),
		);
		await pressAndFlush("Save activity");
		await waitFor(() => expect(update).toHaveBeenCalledTimes(2));
		expect(create).toHaveBeenCalledTimes(2);
		expect(update.mock.calls[1][0]).toMatchObject({
			id: "run-1",
			distanceMeters: 6000,
		});
	});

	it("sends null to clear optional fields during edit", async () => {
		const update = jest.fn().mockResolvedValue(null);
		mockUseQuery.mockReturnValue(saved);
		mockMutations({ "enduranceActivities:update": update });
		renderEditor("/endurance/run-1");
		fireEvent.press(screen.getByText("Edit"));
		fireEvent.changeText(screen.getByLabelText("Title"), "");
		fireEvent.changeText(screen.getByLabelText("Notes"), "");
		fireEvent.changeText(screen.getByLabelText("Elevation gain"), "");
		fireEvent.changeText(screen.getByLabelText("Average heart rate"), "");
		fireEvent.changeText(screen.getByLabelText("Effort"), "");
		await pressAndFlush("Save activity");
		await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
		expect(update.mock.calls[0][0]).toMatchObject({
			title: null,
			notes: null,
			elevationGainMeters: null,
			averageHeartRate: null,
			effort: null,
		});
	});

	it("asks before discarding an edited form on Back", async () => {
		renderEditor("/");
		fireEvent.press(screen.getByText("Open editor"));
		fireEvent.changeText(screen.getByLabelText("Distance"), "5");
		act(() => router.back());
		expect(await screen.findByText("Discard changes?")).toBeTruthy();
		fireEvent.press(screen.getByText("Keep editing"));
		expect(screen.getByLabelText("Distance").props.value).toBe("5");
	});
});

describe("endurance detail", () => {
	it("does not queue a delete while offline", async () => {
		const remove = jest.fn();
		mockUseConnectionState.mockReturnValue({
			isWebSocketConnected: false,
		} as ReturnType<typeof useConvexConnectionState>);
		mockUseQuery.mockReturnValue(saved);
		mockMutations({ "enduranceActivities:remove": remove });
		renderEditor("/endurance/run-1");
		fireEvent.press(screen.getByText("Delete"));
		expect(
			await screen.findByText("Connect to delete this activity."),
		).toBeTruthy();
		expect(remove).not.toHaveBeenCalled();
		expect(screen.queryByText("Delete this activity?")).toBeNull();
	});

	it("requires a named confirmation before deleting", async () => {
		const remove = jest.fn().mockResolvedValue(null);
		mockUseQuery.mockReturnValue(saved);
		mockMutations({ "enduranceActivities:remove": remove });
		renderEditor("/endurance/run-1");
		fireEvent.press(screen.getByText("Delete"));
		expect(await screen.findByText("Delete this activity?")).toBeTruthy();
		expect(remove).not.toHaveBeenCalled();
		await pressAndFlush("Delete run");
		await waitFor(() => expect(remove).toHaveBeenCalledWith({ id: "run-1" }));
	});
});
