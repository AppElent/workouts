import {
	cleanup,
	fireEvent,
	render,
	screen,
} from "@testing-library/react-native";
import type { NutritionDiarySnapshot } from "@workouts/core";
import {
	createNutritionCookingRepository,
	type NutritionCookingRepository,
} from "../data/nutrition-cooking-repository";
import { useNutritionOperations } from "../data/nutrition-operation-service";
import { usePersonalFoods } from "../data/personal-foods";
import { useI18n } from "../i18n";
import { SQLiteTestDatabase } from "../test-support/sqlite-test-database";
import { useToast } from "../ui/toast";
import { NutritionCookingScreen } from "./nutrition-cooking";

jest.mock("../data/nutrition-operation-service", () => ({
	mintNutritionUuid: jest.fn(() => "00000000-0000-4000-8000-000000000001"),
	useNutritionOperations: jest.fn(),
}));
jest.mock("../data/personal-foods", () => ({ usePersonalFoods: jest.fn() }));
jest.mock("../i18n", () => ({ useI18n: jest.fn() }));
jest.mock("../ui/toast", () => ({ useToast: jest.fn() }));

const mockUseNutritionOperations = jest.mocked(useNutritionOperations);
const mockUsePersonalFoods = jest.mocked(usePersonalFoods);
const mockUseI18n = jest.mocked(useI18n);
const mockUseToast = jest.mocked(useToast);

const nutrientLabels = {
	energy: "Energy",
	protein: "Protein",
	carbs: "Carbohydrates",
	fat: "Fat",
	saturatedFat: "Saturated fat",
	fibre: "Fibre",
	sugars: "Sugars",
	salt: "Salt",
};

function renderCooking(
	repository: NutritionCookingRepository,
	operations: ReturnType<typeof mockOperations>,
) {
	mockUseI18n.mockReturnValue({
		locale: "en",
		t: { nutrition: { nutrients: nutrientLabels } },
		setLocale: jest.fn(),
	} as never);
	mockUsePersonalFoods.mockReturnValue({ list: () => [] } as never);
	const toast = { error: jest.fn(), success: jest.fn() };
	mockUseToast.mockReturnValue(toast);
	mockUseNutritionOperations.mockReturnValue(operations as never);
	return {
		...render(
			<NutritionCookingScreen
				date="2026-09-12"
				meal="dinner"
				repository={repository}
			/>,
		),
		toast,
	};
}

function mockOperations() {
	const accepted: Array<{
		envelope: {
			operation: {
				kind: "create";
				entry: NutritionDiarySnapshot & { clientEntryId: string };
			};
		};
	}> = [];
	return {
		accepted,
		getSubject: () => "account-a",
		getOperations: () => accepted,
		create: jest.fn(
			(
				_subject: string,
				snapshot: NutritionDiarySnapshot & { clientEntryId: string },
			) => {
				accepted.push({
					envelope: { operation: { kind: "create", entry: snapshot } },
				});
				return "operation-1";
			},
		),
		createBatch: jest.fn(),
	};
}

describe("Nutrition cooking screen", () => {
	afterEach(() => cleanup());

	it("offers direct Log once from the cooking hub", () => {
		const database = new SQLiteTestDatabase();
		const repository = createNutritionCookingRepository(database);
		renderCooking(repository, mockOperations());

		expect(screen.getByText("Log once")).toBeTruthy();
		expect(screen.getByText("Stored only on this device")).toBeTruthy();
		expect(screen.queryByText("Unfinished")).toBeNull();
		repository.close();
	});

	it("logs a one-off entry without creating a Capture Draft", () => {
		const database = new SQLiteTestDatabase();
		const repository = createNutritionCookingRepository(database);
		const operations = mockOperations();
		renderCooking(repository, operations);

		fireEvent.press(screen.getByText("Log once"));
		fireEvent.changeText(
			screen.getByLabelText("Food name in English"),
			"Pasta",
		);
		fireEvent.changeText(screen.getByLabelText("Food name in Dutch"), "Pasta");
		fireEvent.changeText(screen.getByLabelText("Amount"), "250");
		fireEvent.press(screen.getAllByText("Log once")[1]);

		expect(operations.create).toHaveBeenCalledTimes(1);
		expect(screen.getAllByText("Home cooking").length).toBeGreaterThanOrEqual(
			1,
		);
		repository.close();
	});
});
