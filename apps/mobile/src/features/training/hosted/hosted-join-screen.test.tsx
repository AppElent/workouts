import { act, screen, waitFor } from "@testing-library/react-native";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { router, Stack } from "expo-router";
import { renderRouter } from "expo-router/testing-library";
import { Text } from "react-native";
import { LocaleProvider } from "../../../i18n";
import { AppearanceProvider } from "../../../theme";
import { HostedJoinScreen } from "./hosted-join-screen";
import { pendingJoin, rememberPendingJoin } from "./pending-join";

jest.mock("convex/react", () => ({
	...jest.requireActual("convex/react"),
	useMutation: jest.fn(),
}));

const mockUseMutation = jest.mocked(useMutation);
const TOKEN = "aB3dEfGh5jKmNpQr7t";

async function renderJoin(join: jest.Mock, url = `/join/${TOKEN}`) {
	mockUseMutation.mockReturnValue(join as never);
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
			"join/[token]": HostedJoinScreen,
			session: () => <Text>Session</Text>,
			hosted: () => <Text>Hosted list</Text>,
		},
		{ initialUrl: url },
	);
}

describe("HostedJoinScreen", () => {
	it("joins once and replaces itself with the session", async () => {
		const join = jest.fn(async () => "session-1");
		rememberPendingJoin(TOKEN);
		const app = await renderJoin(join);
		await waitFor(() => expect(app.getPathname()).toBe("/session"));
		expect(app.getSearchParams()).toEqual({ id: "session-1" });
		expect(join).toHaveBeenCalledTimes(1);
		expect(join).toHaveBeenCalledWith({ token: TOKEN });
		expect(pendingJoin()).toBeNull();
	});

	it("explains a closed workout and offers the code box", async () => {
		const join = jest.fn(async () => {
			throw new ConvexError({ code: "hostedClosed" });
		});
		await renderJoin(join);
		expect(
			await screen.findByText("This hosted workout has closed."),
		).toBeVisible();
		expect(screen.getByText("Could not join that workout.")).toBeVisible();
		expect(
			screen.getByRole("button", { name: "Join with a code" }),
		).toBeVisible();
	});

	it.each([
		"/join/not%20a%20token",
		`/join/${encodeURIComponent(`https://foundry.appelent.nl/join/${TOKEN}`)}`,
		`/join/${encodeURIComponent(`/join/${TOKEN}`)}`,
	])("does not call the server for the malformed segment %s", async (url) => {
		const join = jest.fn();
		await renderJoin(join, url);
		expect(
			await screen.findByText(
				"Check the link, or ask the host for the join code.",
			),
		).toBeVisible();
		expect(join).not.toHaveBeenCalled();
	});

	it("ignores a join that finishes while another screen covers it", async () => {
		let resolve: (sessionId: string) => void = () => {};
		const join = jest.fn(
			() =>
				new Promise<string>((done) => {
					resolve = done;
				}),
		);
		const app = await renderJoin(join);
		await waitFor(() => expect(join).toHaveBeenCalledTimes(1));
		await act(async () => router.push("/hosted"));
		await act(async () => resolve("session-1"));
		expect(app.getPathname()).toBe("/hosted");
	});

	it("ignores a join that finishes after the user left", async () => {
		let resolve: (sessionId: string) => void = () => {};
		const join = jest.fn(
			() =>
				new Promise<string>((done) => {
					resolve = done;
				}),
		);
		const app = await renderJoin(join);
		await waitFor(() => expect(join).toHaveBeenCalledTimes(1));
		await act(async () => router.replace("/hosted"));
		await act(async () => resolve("session-1"));
		expect(app.getPathname()).toBe("/hosted");
	});
});
