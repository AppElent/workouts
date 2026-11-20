/**
 * Hosted Workouts are parked (APP-437): with HOSTED_WORKOUTS_ENABLED off, the
 * real route files for the list, the host console, and join links all show
 * the paused screen and never join.
 */

import { HOSTED_WORKOUTS_ENABLED } from "@foundry/core/features";
import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { useMutation } from "convex/react";
import { Stack } from "expo-router";
import { renderRouter } from "expo-router/testing-library";
import { Text } from "react-native";
import HostedRoute from "../../../../app/(app)/hosted";
import HostedDetailRoute from "../../../../app/(app)/hosted/[id]";
import JoinRoute from "../../../../app/(app)/join/[token]";
import { LocaleProvider } from "../../../i18n";
import { AppearanceProvider } from "../../../theme";
import { pendingJoin, rememberPendingJoin } from "./pending-join";

jest.mock("convex/react", () => ({
	...jest.requireActual("convex/react"),
	useMutation: jest.fn(),
}));

async function renderAt(url: string) {
	return renderRouter(
		{
			_layout: () => (
				<LocaleProvider>
					<AppearanceProvider>
						<Stack />
					</AppearanceProvider>
				</LocaleProvider>
			),
			index: () => <Text>Coach</Text>,
			train: () => <Text>Train</Text>,
			hosted: HostedRoute,
			"hosted/[id]": HostedDetailRoute,
			"join/[token]": JoinRoute,
		},
		{ initialUrl: url },
	);
}

it("is switched off", () => {
	expect(HOSTED_WORKOUTS_ENABLED).toBe(false);
});

it.each(["/hosted", "/hosted/hw-1", "/join/aB3dEfGh5jKmNpQr7t"])(
	"shows the paused state at %s",
	async (url) => {
		await renderAt(url);
		expect(await screen.findByText("Hosted workouts are paused")).toBeTruthy();
		expect(screen.queryByText("Joining…")).toBeNull();
	},
);

it("never joins from a join link and forgets the pending join", async () => {
	const join = jest.fn();
	jest.mocked(useMutation).mockReturnValue(join as never);
	rememberPendingJoin("aB3dEfGh5jKmNpQr7t");
	const app = await renderAt("/join/aB3dEfGh5jKmNpQr7t");
	await screen.findByText("Hosted workouts are paused");
	await waitFor(() => expect(pendingJoin()).toBeNull());
	fireEvent.press(screen.getByRole("button", { name: "Go to Train" }));
	await waitFor(() => expect(app.getPathname()).toBe("/train"));
	expect(join).not.toHaveBeenCalled();
});
