// @vitest-environment jsdom
import { cleanup, render as rtlRender, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const password = vi.fn();
const finalize = vi.fn();
const signIn = { status: "needs_identifier", password, finalize };
vi.mock("@clerk/react", () => ({ useSignIn: () => ({ signIn }) }));

import { LocaleProvider } from "#/lib/i18n";
import { TestLoginButton } from "../TestLoginButton";

function render(ui: React.ReactElement) {
	return rtlRender(ui, {
		wrapper: ({ children }) => (
			<LocaleProvider initialLocale="en">{children}</LocaleProvider>
		),
	});
}

describe("TestLoginButton", () => {
	afterEach(() => {
		cleanup();
		vi.unstubAllEnvs();
		password.mockReset();
		finalize.mockReset();
		signIn.status = "needs_identifier";
	});

	it("renders nothing without a test instance + creds", () => {
		vi.stubEnv("VITE_CLERK_PUBLISHABLE_KEY", "pk_live_x");
		const { container } = render(<TestLoginButton onSuccess={() => {}} />);
		expect(container.firstChild).toBeNull();
	});

	it("renders nothing on a test instance when creds are absent", () => {
		vi.stubEnv("VITE_CLERK_PUBLISHABLE_KEY", "pk_test_x");
		vi.stubEnv("VITE_TEST_USER_EMAIL", "");
		vi.stubEnv("VITE_TEST_USER_PASSWORD", "");
		const { container } = render(<TestLoginButton onSuccess={() => {}} />);
		expect(container.firstChild).toBeNull();
	});

	it("signs in with env creds when shown and clicked", async () => {
		vi.stubEnv("VITE_CLERK_PUBLISHABLE_KEY", "pk_test_x");
		vi.stubEnv("VITE_TEST_USER_EMAIL", "test@test.com");
		vi.stubEnv("VITE_TEST_USER_PASSWORD", "appelent_test");
		password.mockImplementation(async () => {
			signIn.status = "complete";
			return { error: null };
		});
		finalize.mockResolvedValue({ error: null });
		const onSuccess = vi.fn();

		render(<TestLoginButton onSuccess={onSuccess} />);
		screen.getByRole("button", { name: /test/i }).click();
		await vi.waitFor(() => expect(finalize).toHaveBeenCalled());
		expect(password).toHaveBeenCalledWith({
			identifier: "test@test.com",
			password: "appelent_test",
		});
		expect(onSuccess).toHaveBeenCalled();
	});
});
