import {
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react-native";
import type { ReactNode } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import {
	createPersonalFoodRepository,
	type PersonalFood,
	type PersonalFoodRepository,
} from "../data/personal-food-repository";
import { PersonalFoodsProvider } from "../data/personal-foods";
import { LocaleProvider } from "../i18n";
import {
	clearPreference,
	PREFERENCE_KEYS,
	writePreference,
} from "../prefs/local-preference";
import { SQLiteTestDatabase } from "../test-support/sqlite-test-database";
import { ToastProvider } from "../ui/toast";
import { PersonalFoodEditor } from "./personal-food-editor";

function Providers({
	children,
	repository,
}: {
	children: ReactNode;
	repository: PersonalFoodRepository;
}) {
	return (
		<SafeAreaProvider
			initialMetrics={{
				frame: { x: 0, y: 0, width: 390, height: 844 },
				insets: { top: 0, right: 0, bottom: 0, left: 0 },
			}}
		>
			<LocaleProvider>
				<ToastProvider>
					<PersonalFoodsProvider repository={repository}>
						{children}
					</PersonalFoodsProvider>
				</ToastProvider>
			</LocaleProvider>
		</SafeAreaProvider>
	);
}

function renderEditor(
	repository = createPersonalFoodRepository(new SQLiteTestDatabase()),
) {
	const onSaved = jest.fn<void, [PersonalFood]>();
	render(<PersonalFoodEditor onSaved={onSaved} onCancel={jest.fn()} />, {
		wrapper: ({ children }) => (
			<Providers repository={repository}>{children}</Providers>
		),
	});
	return { onSaved, repository };
}

describe("Personal Food authoring", () => {
	afterEach(() => clearPreference(PREFERENCE_KEYS.locale));

	it("creates bilingual nutrition with zero, trace, absent, and a custom Serving", async () => {
		const { onSaved, repository } = renderEditor();

		expect(screen.getByText("Stored only on this device")).toBeTruthy();
		expect(
			screen.getByText(
				/do not appear on a second device.*lost if you uninstall.*best effort/i,
			),
		).toBeTruthy();
		for (const nutrient of [
			"Energy",
			"Protein",
			"Carbohydrates",
			"Fat",
			"Saturated fat",
			"Fibre",
			"Sugars",
			"Salt",
		]) {
			expect(screen.getByText(nutrient)).toBeTruthy();
		}

		fireEvent.changeText(
			screen.getByLabelText("English name"),
			"Training drink",
		);
		fireEvent.changeText(screen.getByLabelText("Dutch name"), "Trainingsdrank");
		fireEvent.press(screen.getByLabelText("Millilitres"));
		fireEvent.press(screen.getByLabelText("Energy: Amount"));
		fireEvent.changeText(screen.getByLabelText("Energy per 100 ml"), "0");
		fireEvent.press(screen.getByLabelText("Protein: Trace"));
		fireEvent.press(screen.getByText("Add Serving"));
		fireEvent.changeText(
			screen.getByLabelText("Serving 1 English label"),
			"Bottle",
		);
		fireEvent.changeText(
			screen.getByLabelText("Serving 1 Dutch label"),
			"Fles",
		);
		fireEvent.changeText(
			screen.getByLabelText("Serving 1 amount in ml"),
			"500",
		);
		fireEvent.press(screen.getByText("Save Personal Food"));

		await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
		const created = repository.find(onSaved.mock.calls[0][0].id);
		expect(created).toMatchObject({
			name: { en: "Training drink", nl: "Trainingsdrank" },
			baseUnit: "ml",
			nutrients: {
				energy: { kind: "value", amount: 0 },
				protein: { kind: "trace" },
				carbs: { kind: "absent" },
			},
			servings: [{ label: { en: "Bottle", nl: "Fles" }, amount: 500 }],
		});
	}, 15_000);

	it("keeps invalid input in place and explains what must change", async () => {
		const { repository } = renderEditor();
		fireEvent.changeText(
			screen.getByLabelText("Dutch name"),
			"Alleen Nederlands",
		);
		fireEvent.press(screen.getByText("Save Personal Food"));

		expect(await screen.findByText("English name is required.")).toBeTruthy();
		expect(screen.getByDisplayValue("Alleen Nederlands")).toBeTruthy();
		expect(repository.list()).toEqual([]);
	});

	it("surfaces device storage failure and retains the authored fields", async () => {
		const real = createPersonalFoodRepository(new SQLiteTestDatabase());
		const failing: PersonalFoodRepository = {
			...real,
			create: () => {
				throw new Error("disk full");
			},
		};
		renderEditor(failing);
		fireEvent.changeText(screen.getByLabelText("English name"), "Keep me");
		fireEvent.changeText(screen.getByLabelText("Dutch name"), "Bewaar mij");
		fireEvent.press(screen.getByText("Save Personal Food"));

		expect(
			await screen.findByText(
				"This Personal Food could not be saved. Your changes are still here.",
			),
		).toBeTruthy();
		expect(screen.getByDisplayValue("Keep me")).toBeTruthy();
	});

	it("shows the full device-only disclosure in Dutch", () => {
		writePreference(PREFERENCE_KEYS.locale, "nl");
		renderEditor();

		expect(screen.getByText("Alleen op dit apparaat opgeslagen")).toBeTruthy();
		expect(
			screen.getByText(
				/niet op een tweede apparaat.*verloren gaan.*beste vermogen/i,
			),
		).toBeTruthy();
	});
});
