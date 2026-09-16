import { fireEvent, render, screen } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AddRow, DisclosureRow, FormSection, StepperField } from "./form";

function renderForm(children: ReactNode) {
	return render(
		<SafeAreaProvider
			initialMetrics={{
				frame: { x: 0, y: 0, width: 390, height: 844 },
				insets: { top: 0, right: 0, bottom: 34, left: 0 },
			}}
		>
			{children}
		</SafeAreaProvider>,
	);
}

it("exposes semantic grouped actions without prescribing screen layout", () => {
	const onDisclosure = jest.fn();
	const onAdd = jest.fn();
	renderForm(
		<FormSection title="Portions" footer="Optional amounts you use often.">
			<DisclosureRow
				label="More nutrients"
				expanded={false}
				onPress={onDisclosure}
			/>
			<AddRow label="Add portion" onPress={onAdd} />
		</FormSection>,
	);

	fireEvent.press(screen.getByRole("button", { name: "More nutrients" }));
	fireEvent.press(screen.getByRole("button", { name: "Add portion" }));
	expect(onDisclosure).toHaveBeenCalledTimes(1);
	expect(onAdd).toHaveBeenCalledTimes(1);
});

it("keeps stepper bounds and increments inside the design-system seam", () => {
	const onChange = jest.fn();
	renderForm(
		<StepperField label="sets" value={1} min={1} onChange={onChange} />,
	);

	fireEvent.press(screen.getByRole("button", { name: "Decrease sets" }));
	fireEvent.press(screen.getByRole("button", { name: "Increase sets" }));
	expect(onChange).toHaveBeenNthCalledWith(1, 1);
	expect(onChange).toHaveBeenNthCalledWith(2, 2);
});
