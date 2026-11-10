import {
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from "@testing-library/react";
import { vi } from "vitest";
import { ToastHost } from "#/components/ui/toast";
import { LocaleProvider } from "#/lib/i18n";
import { ReportProblem } from "./ReportProblem";

const mocks = vi.hoisted(() => ({
	send: vi.fn(),
	enabled: true,
}));
vi.mock("@sentry/react", () => ({
	getClient: () => ({ getOptions: () => ({ enabled: mocks.enabled }) }),
	sendFeedback: mocks.send,
}));
vi.mock("@tanstack/react-router", () => ({
	useRouter: () => ({ state: { matches: [{ routeId: "/log/$sessionId" }] } }),
}));

beforeEach(() => {
	vi.clearAllMocks();
	mocks.enabled = true;
	mocks.send.mockResolvedValue("feedback-id");
});

const notifications = () =>
	within(screen.getByRole("region", { name: "Notifications" }));
const ERROR = "Could not send your report. Please try again.";

function setup() {
	render(
		<LocaleProvider initialLocale="en">
			<ToastHost>
				<ReportProblem />
			</ToastHost>
		</LocaleProvider>,
	);
	fireEvent.click(screen.getByRole("button", { name: "Report a problem" }));
	fireEvent.change(screen.getByRole("textbox"), {
		target: { value: "Save did not work" },
	});
}

it("sends feedback with a route template and optional replay, without an automatic screenshot", async () => {
	setup();
	fireEvent.click(screen.getByRole("button", { name: "Send report" }));
	await waitFor(() =>
		expect(mocks.send).toHaveBeenCalledWith(
			{
				message: "Save did not work",
				tags: { screen: "/log/$sessionId" },
				url: expect.stringContaining("/log/$sessionId"),
			},
			{ attachments: undefined, includeReplay: true },
		),
	);
});

it("keeps the draft when submission fails", async () => {
	mocks.send.mockRejectedValue(new Error("Network failure"));
	setup();
	fireEvent.click(screen.getByRole("button", { name: "Send report" }));
	expect(await notifications().findByText(ERROR)).toBeTruthy();
	expect(screen.getByRole<HTMLTextAreaElement>("textbox").value).toBe(
		"Save did not work",
	);
	expect(screen.getByRole("dialog")).toBeTruthy();
});

it("does not claim success when local reporting is disabled", async () => {
	mocks.enabled = false;
	setup();
	fireEvent.click(screen.getByRole("button", { name: "Send report" }));
	expect(await notifications().findByText(ERROR)).toBeTruthy();
	expect(mocks.send).not.toHaveBeenCalled();
});

it("lets the user remove a screenshot before sending", async () => {
	URL.createObjectURL = vi.fn(() => "blob:preview");
	URL.revokeObjectURL = vi.fn();
	setup();
	const file = new File(["image"], "personal-name.png", { type: "image/png" });
	fireEvent.change(screen.getByLabelText("Add screenshot"), {
		target: { files: [file] },
	});
	expect(await screen.findByRole("img")).toBeTruthy();
	fireEvent.click(screen.getByRole("button", { name: "Remove screenshot" }));
	await waitFor(() => expect(screen.queryByRole("img")).toBeNull());
	fireEvent.click(screen.getByRole("button", { name: "Send report" }));
	await waitFor(() => expect(mocks.send).toHaveBeenCalled());
	expect(mocks.send.mock.calls[0][1].attachments).toBeUndefined();
	expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:preview");
});

it("uploads only the chosen attachment, using a generic filename", async () => {
	URL.createObjectURL = vi.fn(() => "blob:preview");
	URL.revokeObjectURL = vi.fn();
	setup();
	const file = new File(["image"], "personal-name.png", { type: "image/png" });
	Object.defineProperty(file, "arrayBuffer", {
		value: async () => new Uint8Array([1, 2]).buffer,
	});
	fireEvent.change(screen.getByLabelText("Add screenshot"), {
		target: { files: [file] },
	});
	fireEvent.click(screen.getByRole("button", { name: "Send report" }));
	await waitFor(() => expect(mocks.send).toHaveBeenCalled());
	expect(mocks.send.mock.calls[0][1].attachments).toEqual([
		{
			filename: "feedback-screenshot.png",
			contentType: "image/png",
			data: new Uint8Array([1, 2]),
		},
	]);
});
