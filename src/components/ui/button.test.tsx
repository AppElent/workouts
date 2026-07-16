import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "./button";

describe("Button loading", () => {
	it("disables the button and shows a spinner while loading", () => {
		render(<Button loading>Save</Button>);
		const button = screen.getByRole("button") as HTMLButtonElement;
		expect(button.disabled).toBe(true);
		expect(button.querySelector(".animate-spin")).toBeTruthy();
	});

	it("stays enabled without loading", () => {
		render(<Button>Save</Button>);
		const button = screen.getByRole("button") as HTMLButtonElement;
		expect(button.disabled).toBe(false);
		expect(button.querySelector(".animate-spin")).toBeNull();
	});
});
