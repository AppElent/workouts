import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { Select } from "./Select";

// Base UI's Select positioner relies on ResizeObserver / scrollIntoView,
// which jsdom does not implement. Provide minimal no-op polyfills.
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

const OPTIONS = [
	{ value: "compound", label: "Compound" },
	{ value: "isolation", label: "Isolation" },
];

function renderSelect(props: Partial<React.ComponentProps<typeof Select>> = {}) {
	return render(
		<Select
			value=""
			onValueChange={vi.fn()}
			placeholder="Category"
			allLabel="All categories"
			options={OPTIONS}
			{...props}
		/>,
	);
}

describe("Select", () => {
	it("renders a combobox trigger, not a native select", () => {
		renderSelect();
		expect(screen.getByRole("combobox")).toBeTruthy();
		expect(document.querySelector("select")).toBeNull();
	});

	it("shows the placeholder when no value is selected", () => {
		renderSelect({ value: "" });
		expect(screen.getByText("Category")).toBeTruthy();
	});

	it("shows the selected option's label when controlled", () => {
		renderSelect({ value: "compound" });
		expect(screen.getByRole("combobox").textContent).toContain("Compound");
	});

	it("opens a themed listbox with the reset item plus all options", () => {
		renderSelect();
		fireEvent.click(screen.getByRole("combobox"));
		expect(screen.getByRole("listbox")).toBeTruthy();
		expect(screen.getByRole("option", { name: "All categories" })).toBeTruthy();
		expect(screen.getByRole("option", { name: "Compound" })).toBeTruthy();
		expect(screen.getByRole("option", { name: "Isolation" })).toBeTruthy();
	});

	// Note: option-selection commits via Base UI's layout-dependent pointer
	// tracking (@floating-ui), which jsdom cannot drive — the existing repo
	// component tests assert structure only for the same reason. Selecting an
	// option and the resulting filtering are verified in the browser preview.
});
