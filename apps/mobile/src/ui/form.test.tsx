import { fireEvent, screen } from "@testing-library/react-native";
import type { ReactElement, ReactNode } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { LocaleProvider } from "../i18n";
import { renderThemed } from "../test-support/render-themed";
import { AddRow, DisclosureRow, FormSection, StepperField } from "./form";

/** These primitives read their fallback labels from the message catalog. */
const render = async (ui: ReactElement) =>
	await renderThemed(ui, { wrapper: LocaleProvider });

async function renderForm(children: ReactNode) {
	return await render(
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

it("exposes semantic grouped actions without prescribing screen layout", async () => {
	const onDisclosure = jest.fn();
	const onAdd = jest.fn();
	await renderForm(
		<FormSection title="Portions" footer="Optional amounts you use often.">
			<DisclosureRow
				label="More nutrients"
				expanded={false}
				onPress={onDisclosure}
			/>
			<AddRow label="Add portion" onPress={onAdd} />
		</FormSection>,
	);

	await fireEvent.press(screen.getByRole("button", { name: "More nutrients" }));
	await fireEvent.press(screen.getByRole("button", { name: "Add portion" }));
	expect(onDisclosure).toHaveBeenCalledTimes(1);
	expect(onAdd).toHaveBeenCalledTimes(1);
});

it("keeps stepper bounds and increments inside the design-system seam", async () => {
	const onChange = jest.fn();
	await renderForm(
		<StepperField label="sets" value={1} min={1} onChange={onChange} />,
	);

	await fireEvent.press(screen.getByRole("button", { name: "Decrease sets" }));
	await fireEvent.press(screen.getByRole("button", { name: "Increase sets" }));
	expect(onChange).toHaveBeenNthCalledWith(1, 1);
	expect(onChange).toHaveBeenNthCalledWith(2, 2);
});
