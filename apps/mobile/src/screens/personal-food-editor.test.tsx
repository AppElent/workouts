import {
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react-native";
import type { ReactNode } from "react";
import { ActionSheetIOS } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import type { FoodPhotoManager } from "../data/food-photo-manager";
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
	photoManager?: FoodPhotoManager,
) {
	const onSaved = jest.fn<void, [PersonalFood]>();
	render(
		<PersonalFoodEditor
			onSaved={onSaved}
			onCancel={jest.fn()}
			photoManager={photoManager}
		/>,
		{
			wrapper: ({ children }) => (
				<Providers repository={repository}>{children}</Providers>
			),
		},
	);
	return { onSaved, repository };
}

function mockNutritionMenuSelect(index: number) {
	return jest
		.spyOn(ActionSheetIOS, "showActionSheetWithOptions")
		.mockImplementation((_options, onSelect) => onSelect(index));
}

function testPhotoManager(
	overrides: Partial<FoodPhotoManager> = {},
): FoodPhotoManager {
	return {
		choose: jest.fn().mockResolvedValue({ kind: "cancelled" }),
		importRemote: jest.fn(),
		remove: jest.fn(),
		isAvailable: jest.fn().mockReturnValue(true),
		removeOrphans: jest.fn(),
		...overrides,
	};
}

function testFoodDraft() {
	return {
		name: { en: "Apple", nl: "Appel" },
		baseUnit: "g" as const,
		nutrients: {
			energy: { kind: "absent" as const },
			protein: { kind: "absent" as const },
			carbs: { kind: "absent" as const },
			fat: { kind: "absent" as const },
			saturatedFat: { kind: "absent" as const },
			fibre: { kind: "absent" as const },
			sugars: { kind: "absent" as const },
			salt: { kind: "absent" as const },
		},
		servings: [],
		provenance: {
			recordOrigin: "personal" as const,
			nutritionSource: "manual" as const,
			locallyEdited: false,
		},
	};
}

describe("Personal Food compact authoring", () => {
	afterEach(() => {
		clearPreference(PREFERENCE_KEYS.locale);
		jest.restoreAllMocks();
	});

	it("stores a curated Food Visual icon while leaving the default unstored", async () => {
		const first = renderEditor();
		expect(screen.getByText("Food visual")).toBeTruthy();
		expect(screen.getByText("Default")).toBeTruthy();
		fireEvent.changeText(screen.getByLabelText("Name"), "Apple");
		fireEvent.press(screen.getByRole("radio", { name: "Fruit" }));
		fireEvent.press(screen.getByText("Save Personal Food"));
		await waitFor(() => expect(first.onSaved).toHaveBeenCalledTimes(1));
		expect(
			first.repository.find(first.onSaved.mock.calls[0][0].id)?.visual,
		).toEqual({ kind: "icon", preset: "fruit" });

		const second = renderEditor();
		fireEvent.changeText(screen.getByLabelText("Name"), "Plain oats");
		fireEvent.press(screen.getByText("Save Personal Food"));
		await waitFor(() => expect(second.onSaved).toHaveBeenCalledTimes(1));
		expect(
			second.repository.find(second.onSaved.mock.calls[0][0].id)?.visual,
		).toBeUndefined();
	});

	it("stores a manually cropped photo selected from the library", async () => {
		const photoManager = testPhotoManager({
			choose: jest.fn().mockResolvedValue({
				kind: "selected",
				visual: {
					kind: "photo",
					uri: "file:///documents/food-photos/apple.jpg",
				},
			}),
		});
		const { onSaved, repository } = renderEditor(undefined, photoManager);
		fireEvent.changeText(screen.getByLabelText("Name"), "Apple");
		fireEvent.press(screen.getByText("Choose photo"));
		await screen.findByLabelText("Food visual");
		fireEvent.press(screen.getByText("Save Personal Food"));

		await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
		expect(photoManager.choose).toHaveBeenCalledWith("library");
		expect(repository.find(onSaved.mock.calls[0][0].id)?.visual).toEqual({
			kind: "photo",
			uri: "file:///documents/food-photos/apple.jpg",
		});
	});

	it("blocks saving after photo preparation fails until the visual is changed", async () => {
		const photoManager = testPhotoManager({
			choose: jest.fn().mockRejectedValue(new Error("cannot prepare image")),
		});
		const { onSaved, repository } = renderEditor(undefined, photoManager);
		fireEvent.changeText(screen.getByLabelText("Name"), "Apple");
		fireEvent.press(screen.getByText("Choose photo"));

		expect(
			await screen.findByText(
				"That photo could not be prepared. Your current visual is unchanged.",
			),
		).toBeTruthy();
		fireEvent.press(screen.getByText("Save Personal Food"));
		expect(onSaved).not.toHaveBeenCalled();
		expect(repository.list()).toEqual([]);

		fireEvent.press(screen.getByRole("radio", { name: "Fruit" }));
		fireEvent.press(screen.getByText("Save Personal Food"));
		await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
	});

	it("deletes the previous managed photo only after its replacement is saved", async () => {
		const repository = createPersonalFoodRepository(new SQLiteTestDatabase());
		const oldPhoto = {
			kind: "photo" as const,
			uri: "file:///documents/food-photos/old.jpg",
		};
		const food = repository.create({ ...testFoodDraft(), visual: oldPhoto });
		const photoManager = testPhotoManager({
			choose: jest.fn().mockResolvedValue({
				kind: "selected",
				visual: {
					kind: "photo",
					uri: "file:///documents/food-photos/new.jpg",
				},
			}),
		});
		const onSaved = jest.fn<void, [PersonalFood]>();
		render(
			<PersonalFoodEditor
				food={food}
				onSaved={onSaved}
				onCancel={jest.fn()}
				photoManager={photoManager}
			/>,
			{
				wrapper: ({ children }) => (
					<Providers repository={repository}>{children}</Providers>
				),
			},
		);

		fireEvent.press(screen.getByText("Replace photo"));
		await waitFor(() =>
			expect(screen.getByLabelText("Food visual").props.source).toEqual([
				{ uri: "file:///documents/food-photos/new.jpg" },
			]),
		);
		expect(photoManager.remove).not.toHaveBeenCalledWith(oldPhoto);
		fireEvent.press(screen.getByText("Save Personal Food"));

		await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
		expect(repository.find(food.id)?.visual).toEqual({
			kind: "photo",
			uri: "file:///documents/food-photos/new.jpg",
		});
		expect(photoManager.remove).toHaveBeenCalledWith(oldPhoto);
	});
	it("saves a per-serving Recipe estimate without requiring a weight", async () => {
		const { onSaved, repository } = renderEditor();
		fireEvent.changeText(screen.getByLabelText("Name"), "Pasta bowl");
		fireEvent.press(screen.getByText("Recipe"));
		fireEvent.press(screen.getByText("Estimated"));
		fireEvent.press(screen.getByText("Per serving"));
		fireEvent.changeText(screen.getByLabelText("Serving name"), "Bowl");
		fireEvent.changeText(
			screen.getByLabelText("Description (optional)"),
			"Lunch at home",
		);
		fireEvent.changeText(
			screen.getByLabelText("Energy per serving (Bowl)"),
			"550",
		);
		fireEvent.press(screen.getByText("Save Personal Food"));
		await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
		expect(repository.find(onSaved.mock.calls[0][0].id)).toMatchObject({
			classification: "recipe",
			estimated: true,
			baseUnit: "serving",
			nutritionBasis: { kind: "perServing", label: { en: "Bowl", nl: "Bowl" } },
			description: { en: "Lunch at home", nl: "Lunch at home" },
			nutrients: {
				energy: { kind: "value", amount: 550 },
				fat: { kind: "absent" },
			},
		});
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
		fireEvent.press(screen.getByText("Add portion"));
		fireEvent.press(screen.getByText("Save Personal Food"));

		await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
		const created = repository.find(onSaved.mock.calls[0][0].id);
		expect(created).toMatchObject({
			name: { en: "Training drink", nl: "Training drink" },
			estimated: false,
			classification: "ordinary",
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

	it("protects an existing import's reviewed serving basis from provider refresh", async () => {
		const repository = createPersonalFoodRepository(new SQLiteTestDatabase());
		const food = repository.create({
			name: { en: "Imported soup", nl: "Soep" },
			baseUnit: "g",
			nutrients: {
				energy: { kind: "value", amount: 100 },
				protein: { kind: "absent" },
				carbs: { kind: "absent" },
				fat: { kind: "absent" },
				saturatedFat: { kind: "absent" },
				fibre: { kind: "absent" },
				sugars: { kind: "absent" },
				salt: { kind: "absent" },
			},
			servings: [],
			provenance: {
				recordOrigin: "import",
				nutritionSource: "openfoodfacts",
				locallyEdited: false,
				provider: "Open Food Facts",
				barcode: "1234567890123",
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
		fireEvent.press(screen.getByText("Per serving"));
		fireEvent.changeText(screen.getByLabelText("Serving name"), "Bowl");
		fireEvent.press(screen.getByText("Save Personal Food"));
		await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
		expect(repository.find(food.id)).toMatchObject({
			baseUnit: "serving",
			nutritionBasis: { kind: "perServing", label: { en: "Bowl", nl: "Bowl" } },
			estimated: false,
			provenance: {
				recordOrigin: "import",
				nutritionSource: "openfoodfacts",
				locallyEdited: true,
			},
		});
	});

	it("keeps saved servings compact until the user chooses one to edit", async () => {
		const repository = createPersonalFoodRepository(new SQLiteTestDatabase());
		const food = repository.create({
			name: { en: "Training drink", nl: "Trainingsdrank" },
			baseUnit: "ml",
			nutrients: {
				energy: { kind: "value", amount: 10 },
				protein: { kind: "absent" },
				carbs: { kind: "absent" },
				fat: { kind: "absent" },
				saturatedFat: { kind: "absent" },
				fibre: { kind: "absent" },
				sugars: { kind: "absent" },
				salt: { kind: "absent" },
			},
			servings: [{ label: { en: "Bottle", nl: "Fles" }, amount: 500 }],
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

		expect(screen.getByText("Bottle")).toBeTruthy();
		expect(screen.getByText("500 ml")).toBeTruthy();
		expect(screen.queryByLabelText("Serving 1 name")).toBeNull();

		fireEvent.press(screen.getByText("Bottle"));
		fireEvent.changeText(
			screen.getByLabelText("Serving 1 name"),
			"Large bottle",
		);
		fireEvent.changeText(
			screen.getByLabelText("Serving 1 amount in ml"),
			"750",
		);
		fireEvent.press(screen.getByText("Save portion"));

		expect(screen.getByText("Large bottle")).toBeTruthy();
		expect(screen.getByText("750 ml")).toBeTruthy();
		expect(screen.queryByLabelText("Serving 1 name")).toBeNull();

		fireEvent.press(screen.getByText("Save Personal Food"));
		await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
		expect(repository.find(food.id)?.servings).toEqual([
			{ label: { en: "Large bottle", nl: "Fles" }, amount: 750 },
		]);
	});

	it("keeps invalid input in place and explains what must change", async () => {
		const { repository } = renderEditor();
		fireEvent.changeText(screen.getByLabelText("Name"), "");
		fireEvent.press(screen.getByText("Save Personal Food"));

		expect(
			await screen.findByText(
				"Food name English is required and must be at most 500 characters.",
			),
		).toBeTruthy();
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
