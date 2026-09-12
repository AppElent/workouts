import {
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react-native";
import type { ReactNode } from "react";
import { ActionSheetIOS } from "react-native";
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

function mockNutritionMenuSelect(index: number) {
	return jest
		.spyOn(ActionSheetIOS, "showActionSheetWithOptions")
		.mockImplementation((_options, onSelect) => onSelect(index));
}

describe("Personal Food compact authoring", () => {
	afterEach(() => {
		clearPreference(PREFERENCE_KEYS.locale);
		jest.restoreAllMocks();
	});

	it("uses one primary name, falls back to it, and keeps zero, trace, absent, and a custom serving", async () => {
		const { onSaved, repository } = renderEditor();

		expect(screen.getByLabelText("Name")).toBeTruthy();
		expect(screen.queryByLabelText("Dutch name")).toBeNull();
		expect(screen.getByText("Energy")).toBeTruthy();
		expect(screen.getByText("Protein")).toBeTruthy();
		expect(screen.getByText("Carbohydrates")).toBeTruthy();
		expect(screen.getByText("Fat")).toBeTruthy();
		expect(screen.queryByText("Saturated fat")).toBeNull();

		fireEvent.changeText(screen.getByLabelText("Name"), "Training drink");
		fireEvent.press(screen.getByLabelText("Per 100 ml"));
		fireEvent.changeText(screen.getByLabelText("Energy per 100 ml"), "0");
		fireEvent.changeText(screen.getByLabelText("Protein per 100 ml"), "12,5");
		expect(screen.queryByText("Trace")).toBeNull();
		const menu = mockNutritionMenuSelect(1);
		fireEvent.press(screen.getByLabelText("Protein value options"));
		expect(menu).toHaveBeenCalledWith(
			expect.objectContaining({
				title: "Protein value options",
				options: ["Unknown", "Trace", "Close"],
			}),
			expect.any(Function),
		);
		expect(screen.getByLabelText("Protein per 100 ml").props.placeholder).toBe(
			"Trace",
		);
		expect(screen.getByLabelText("Protein per 100 ml").props.editable).not.toBe(
			false,
		);

		fireEvent.press(screen.getByText("Custom servings"));
		fireEvent.press(screen.getByText("Add serving"));
		fireEvent.changeText(screen.getByLabelText("Serving 1 name"), "Bottle");
		fireEvent.changeText(
			screen.getByLabelText("Serving 1 amount in ml"),
			"500",
		);
		fireEvent.press(screen.getByText("Save Personal Food"));

		await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
		const created = repository.find(onSaved.mock.calls[0][0].id);
		expect(created).toMatchObject({
			name: { en: "Training drink", nl: "Training drink" },
			baseUnit: "ml",
			nutrients: {
				energy: { kind: "value", amount: 0 },
				protein: { kind: "trace" },
				carbs: { kind: "absent" },
			},
			servings: [{ label: { en: "Bottle", nl: "Bottle" }, amount: 500 }],
		});
	});

	it("preserves an existing translation while editing from the current locale", async () => {
		const repository = createPersonalFoodRepository(new SQLiteTestDatabase());
		const food = repository.create({
			name: { en: "Training drink", nl: "Trainingsdrank" },
			baseUnit: "g",
			nutrients: {
				energy: { kind: "value", amount: 10 },
				protein: { kind: "trace" },
				carbs: { kind: "absent" },
				fat: { kind: "absent" },
				saturatedFat: { kind: "absent" },
				fibre: { kind: "absent" },
				sugars: { kind: "absent" },
				salt: { kind: "absent" },
			},
			servings: [],
			provenance: {
				recordOrigin: "personal",
				nutritionSource: "manual",
				locallyEdited: false,
			},
		});
		const onSaved = jest.fn<void, [PersonalFood]>();
		render(
			<PersonalFoodEditor food={food} onSaved={onSaved} onCancel={jest.fn()} />,
			{
				wrapper: ({ children }) => (
					<Providers repository={repository}>{children}</Providers>
				),
			},
		);

		fireEvent.changeText(screen.getByLabelText("Name"), "Workout drink");
		fireEvent.press(screen.getByText("Save Personal Food"));
		await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
		expect(repository.find(food.id)?.name).toEqual({
			en: "Workout drink",
			nl: "Trainingsdrank",
		});
		expect(repository.find(food.id)?.nutrients.protein).toEqual({
			kind: "trace",
		});
	});

	it("keeps invalid input in place and explains what must change", async () => {
		const { repository } = renderEditor();
		fireEvent.changeText(screen.getByLabelText("Name"), "");
		fireEvent.press(screen.getByText("Save Personal Food"));

		expect(await screen.findByText("English name is required.")).toBeTruthy();
		expect(screen.getByLabelText("Name").props.value).toBe("");
		expect(repository.list()).toEqual([]);
	});

	it("shows additional nutrients only after expanding and keeps Dutch labels readable", () => {
		writePreference(PREFERENCE_KEYS.locale, "nl");
		renderEditor();

		expect(screen.getByLabelText("Naam")).toBeTruthy();
		fireEvent.press(screen.getByLabelText("Per 100 ml"));
		expect(screen.getByLabelText("Energie per 100 ml")).toBeTruthy();
		fireEvent.changeText(screen.getByLabelText("Energie per 100 ml"), "0");
		const menu = mockNutritionMenuSelect(1);
		fireEvent.press(screen.getByLabelText("Opties voor Energie"));
		expect(menu).toHaveBeenCalledWith(
			expect.objectContaining({
				title: "Opties voor Energie",
				options: ["Onbekend", "Spoor", "Sluiten"],
			}),
			expect.any(Function),
		);
		expect(screen.getByLabelText("Energie per 100 ml").props.placeholder).toBe(
			"Spoor",
		);
		expect(screen.getByText("Energie")).toBeTruthy();
		expect(screen.queryByText("Verzadigd vet")).toBeNull();
		fireEvent.press(screen.getByText("Meer voedingswaarden"));
		expect(screen.getByText("Verzadigd vet")).toBeTruthy();
		expect(screen.getByText("Vezels")).toBeTruthy();
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
		fireEvent.changeText(screen.getByLabelText("Name"), "Keep me");
		fireEvent.press(screen.getByText("Save Personal Food"));

		expect(
			await screen.findByText(
				"This Personal Food could not be saved. Your changes are still here.",
			),
		).toBeTruthy();
		expect(screen.getByDisplayValue("Keep me")).toBeTruthy();
	});
});
