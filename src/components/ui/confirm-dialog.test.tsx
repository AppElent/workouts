import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "#/lib/i18n";
import { ConfirmDialogProvider, useConfirm } from "./confirm-dialog";

// Base UI dialogs rely on browser APIs jsdom doesn't implement (same
// polyfills as Select.test.tsx).
beforeAll(() => {
	if (!("ResizeObserver" in globalThis)) {
		globalThis.ResizeObserver = class {
			observe() {}
			unobserve() {}
			disconnect() {}
		} as unknown as typeof ResizeObserver;
	}
	if (!Element.prototype.scrollIntoView) {
		Element.prototype.scrollIntoView = () => {};
	}
});

function Harness({ onResult }: { onResult: (value: boolean) => void }) {
	const confirm = useConfirm();
	return (
		<button
			type="button"
			onClick={async () => {
				onResult(
					await confirm({
						title: "Delete this workout?",
						description: "This cannot be undone.",
						confirmLabel: "Delete workout",
						destructive: true,
					}),
				);
			}}
		>
			trigger
		</button>
	);
}

function setup() {
	const onResult = vi.fn();
	render(
		<LocaleProvider initialLocale="en">
			<ConfirmDialogProvider>
				<Harness onResult={onResult} />
			</ConfirmDialogProvider>
		</LocaleProvider>,
	);
	fireEvent.click(screen.getByText("trigger"));
	return onResult;
}

function DoubleHarness({
	onResultA,
	onResultB,
}: {
	onResultA: (value: boolean) => void;
	onResultB: (value: boolean) => void;
}) {
	const confirm = useConfirm();
	return (
		<>
			<button
				type="button"
				onClick={async () => {
					onResultA(await confirm({ title: "A", confirmLabel: "Confirm A" }));
				}}
			>
				trigger A
			</button>
			<button
				type="button"
				onClick={async () => {
					onResultB(await confirm({ title: "B", confirmLabel: "Confirm B" }));
				}}
			>
				trigger B
			</button>
		</>
	);
}

describe("useConfirm", () => {
	it("opens a dialog with title, description, and verb-specific labels", () => {
		setup();
		expect(screen.getByText("Delete this workout?")).toBeTruthy();
		expect(screen.getByText("This cannot be undone.")).toBeTruthy();
		expect(screen.getByText("Delete workout")).toBeTruthy();
		expect(screen.getByText("Cancel")).toBeTruthy();
	});

	it("resolves true on confirm", async () => {
		const onResult = setup();
		fireEvent.click(screen.getByText("Delete workout"));
		await waitFor(() => expect(onResult).toHaveBeenCalledWith(true));
	});

	it("resolves false on cancel", async () => {
		const onResult = setup();
		fireEvent.click(screen.getByText("Cancel"));
		await waitFor(() => expect(onResult).toHaveBeenCalledWith(false));
	});

	it("resolves false on Escape", async () => {
		const onResult = setup();
		fireEvent.keyDown(document.activeElement ?? document.body, {
			key: "Escape",
		});
		await waitFor(() => expect(onResult).toHaveBeenCalledWith(false));
	});

	it("settles the first confirm as false when a second opens", async () => {
		const onResultA = vi.fn();
		const onResultB = vi.fn();
		render(
			<LocaleProvider initialLocale="en">
				<ConfirmDialogProvider>
					<DoubleHarness onResultA={onResultA} onResultB={onResultB} />
				</ConfirmDialogProvider>
			</LocaleProvider>,
		);
		fireEvent.click(screen.getByText("trigger A"));
		fireEvent.click(screen.getByText("trigger B"));
		// First confirm is settled as cancelled the moment the second opens.
		await waitFor(() => expect(onResultA).toHaveBeenCalledWith(false));
		// The second dialog is what's now on screen; cancelling it resolves B.
		fireEvent.click(screen.getByText("Cancel"));
		await waitFor(() => expect(onResultB).toHaveBeenCalledWith(false));
	});

	it("throws when used outside the provider", () => {
		function Bare() {
			useConfirm();
			return null;
		}
		expect(() => render(<Bare />)).toThrow(/ConfirmDialogProvider/);
	});
});
