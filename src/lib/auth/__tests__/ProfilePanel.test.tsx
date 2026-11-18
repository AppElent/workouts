// @vitest-environment jsdom
import {
	cleanup,
	fireEvent,
	render as rtlRender,
	screen,
	within,
} from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

// jsdom here ships without localStorage (opaque origin) or matchMedia; the
// embedded AppearanceSettings touches both on mount, so provide minimal stubs.
beforeAll(() => {
	const store = new Map<string, string>();
	vi.stubGlobal("localStorage", {
		getItem: (k: string) => store.get(k) ?? null,
		setItem: (k: string, v: string) => store.set(k, v),
		removeItem: (k: string) => store.delete(k),
		clear: () => store.clear(),
	});
	vi.stubGlobal("matchMedia", (query: string) => ({
		matches: false,
		media: query,
		addEventListener: () => {},
		removeEventListener: () => {},
		addListener: () => {},
		removeListener: () => {},
		onchange: null,
		dispatchEvent: () => false,
	}));
});

const update = vi.fn();
const updatePassword = vi.fn();
const signOut = vi.fn();
// Stable user reference so ProfilePanel's seeding effect (deps: [user]) doesn't
// re-run on every render and clobber typed input.
const user = {
	firstName: "Eric",
	lastName: "Jansen",
	primaryEmailAddress: { emailAddress: "e@x.com" },
	passwordEnabled: true,
	update,
	updatePassword,
};
vi.mock("@clerk/react", () => ({
	useUser: () => ({ isLoaded: true, isSignedIn: true, user }),
	useClerk: () => ({ signOut }),
}));

import { ToastHost } from "#/components/ui/toast";
import { LocaleProvider } from "#/lib/i18n";
import { ProfilePanel } from "../ProfilePanel";

function render(ui: React.ReactElement) {
	return rtlRender(ui, {
		wrapper: ({ children }) => (
			<LocaleProvider initialLocale="en">
				<ToastHost>{children}</ToastHost>
			</LocaleProvider>
		),
	});
}

describe("ProfilePanel", () => {
	afterEach(() => {
		cleanup();
		for (const m of [update, updatePassword, signOut]) m.mockReset();
		user.passwordEnabled = true;
	});

	it("saves name changes", async () => {
		update.mockResolvedValue({});
		render(<ProfilePanel />);
		fireEvent.change(screen.getByLabelText("First name"), {
			target: { value: "Erik" },
		});
		fireEvent.click(screen.getByRole("button", { name: /save profile/i }));
		await vi.waitFor(() =>
			expect(update).toHaveBeenCalledWith({
				firstName: "Erik",
				lastName: "Jansen",
			}),
		);
	});

	it("signs out", () => {
		render(<ProfilePanel />);
		fireEvent.click(screen.getByRole("button", { name: /sign out/i }));
		expect(signOut).toHaveBeenCalled();
	});

	it("changes the password and signs out other sessions", async () => {
		updatePassword.mockResolvedValue({});
		render(<ProfilePanel />);
		fireEvent.change(screen.getByLabelText("Current password"), {
			target: { value: "old-password" },
		});
		fireEvent.change(screen.getByLabelText("New password"), {
			target: { value: "a-new-password" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Change password" }));
		await vi.waitFor(() =>
			expect(updatePassword).toHaveBeenCalledWith({
				currentPassword: "old-password",
				newPassword: "a-new-password",
				signOutOfOtherSessions: true,
			}),
		);
		expect(
			await within(
				screen.getByRole("region", { name: "Notifications" }),
			).findByText("Password changed. Other devices were signed out."),
		).toBeTruthy();
		expect(signOut).not.toHaveBeenCalled();
		expect(
			(screen.getByLabelText("Current password") as HTMLInputElement).value,
		).toBe("");
	});

	it("keeps the form and shows the error when the change fails", async () => {
		updatePassword.mockRejectedValue(new Error("nope"));
		render(<ProfilePanel />);
		fireEvent.change(screen.getByLabelText("Current password"), {
			target: { value: "wrong" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Change password" }));
		expect(await screen.findByRole("alert")).toBeTruthy();
		expect(
			(screen.getByLabelText("Current password") as HTMLInputElement).value,
		).toBe("wrong");
	});

	it("hides the change-password form for an account without a password", () => {
		user.passwordEnabled = false;
		render(<ProfilePanel />);
		expect(screen.queryByLabelText("Current password")).toBeNull();
		expect(
			screen.queryByRole("button", { name: "Change password" }),
		).toBeNull();
		expect(screen.getByRole("button", { name: /save profile/i })).toBeTruthy();
	});
});
