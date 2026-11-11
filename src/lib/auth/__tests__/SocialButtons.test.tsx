// @vitest-environment jsdom
import {
	cleanup,
	fireEvent,
	render as rtlRender,
	screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sso = vi.fn();
vi.mock("@clerk/react", () => ({ useSignIn: () => ({ signIn: { sso } }) }));

import { LocaleProvider } from "#/lib/i18n";
import { SocialButtons } from "../SocialButtons";

function render(ui: React.ReactElement) {
	return rtlRender(ui, {
		wrapper: ({ children }) => (
			<LocaleProvider initialLocale="en">{children}</LocaleProvider>
		),
	});
}

function renderButtons() {
	return render(<SocialButtons />);
}

describe("SocialButtons", () => {
	beforeEach(() => {
		vi.stubEnv("VITE_CLERK_PUBLISHABLE_KEY", "pk_test_x");
	});

	afterEach(() => {
		cleanup();
		vi.unstubAllEnvs();
		sso.mockReset();
	});

	it("offers Google only on the development Clerk instance", () => {
		vi.stubEnv("VITE_CLERK_PUBLISHABLE_KEY", "pk_live_x");
		renderButtons();
		expect(screen.queryByRole("button", { name: "Continue with Google" })).toBe(
			null,
		);
		expect(
			screen.getByRole("button", { name: "Continue with Apple" }),
		).toBeDefined();
	});

	it("redirects to the chosen provider via the SSO callback", () => {
		sso.mockResolvedValue({ error: null });
		renderButtons();
		fireEvent.click(
			screen.getByRole("button", { name: "Continue with Microsoft" }),
		);
		expect(sso).toHaveBeenCalledWith({
			strategy: "oauth_microsoft",
			redirectCallbackUrl: "/sso-callback",
			redirectUrl: "/dashboard",
		});
	});

	it("shows a readable error when the redirect cannot start", async () => {
		sso.mockResolvedValue({
			error: { errors: [{ message: "Provider disabled." }] },
		});
		renderButtons();
		fireEvent.click(
			screen.getByRole("button", { name: "Continue with Google" }),
		);
		expect(await screen.findByText("Provider disabled.")).toBeDefined();
	});

	it("shows the labels in Dutch", () => {
		rtlRender(
			<LocaleProvider initialLocale="nl">
				<SocialButtons />
			</LocaleProvider>,
		);
		expect(
			screen.getByRole("button", { name: "Doorgaan met Microsoft" }),
		).toBeDefined();
		expect(screen.getByText("of")).toBeDefined();
	});

	it("blocks every provider while one redirect is starting", () => {
		sso.mockReturnValue(new Promise(() => {}));
		renderButtons();
		fireEvent.click(
			screen.getByRole("button", { name: "Continue with Google" }),
		);
		const microsoft = screen.getByRole("button", {
			name: "Continue with Microsoft",
		}) as HTMLButtonElement;
		expect(microsoft.disabled).toBe(true);
		fireEvent.click(microsoft);
		expect(sso).toHaveBeenCalledTimes(1);
	});
});
