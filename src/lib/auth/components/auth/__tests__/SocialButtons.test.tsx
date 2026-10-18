// @vitest-environment jsdom
import {
	cleanup,
	fireEvent,
	render as rtlRender,
	screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const sso = vi.fn();
vi.mock("@clerk/react", () => ({ useSignIn: () => ({ signIn: { sso } }) }));

import { LocaleProvider } from "#/lib/i18n";
import { AuthConfigProvider, DEFAULT_AUTH_CONFIG } from "../AuthConfigProvider";
import { SocialButtons } from "../SocialButtons";
import type { AuthConfig } from "../types";

function render(ui: React.ReactElement) {
	return rtlRender(ui, {
		wrapper: ({ children }) => (
			<LocaleProvider initialLocale="en">{children}</LocaleProvider>
		),
	});
}

const CONFIG: AuthConfig = {
	...DEFAULT_AUTH_CONFIG,
	socialProviders: [
		{ id: "google", label: "Google", strategy: "oauth_google" },
		{ id: "microsoft", label: "Microsoft", strategy: "oauth_microsoft" },
	],
};

function renderButtons(config: AuthConfig = CONFIG) {
	return render(
		<AuthConfigProvider config={config}>
			<SocialButtons />
		</AuthConfigProvider>,
	);
}

describe("SocialButtons", () => {
	afterEach(() => {
		cleanup();
		sso.mockReset();
	});

	it("renders nothing without configured providers", () => {
		const { container } = renderButtons(DEFAULT_AUTH_CONFIG);
		expect(container.innerHTML).toBe("");
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
				<AuthConfigProvider config={CONFIG}>
					<SocialButtons />
				</AuthConfigProvider>
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
