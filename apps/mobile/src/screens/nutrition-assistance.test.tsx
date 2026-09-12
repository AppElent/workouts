import { fireEvent, render, screen } from "@testing-library/react-native";
import { NutritionAssistanceScreen } from "./nutrition-assistance";

const mockCreateBatch = jest.fn();
const mockPersonalCreate = jest.fn();
const mockDiaryCreate = jest.fn();
const mockPersonalFood = {
	id: "personal-yoghurt",
	name: { en: "Plain yoghurt", nl: "Yoghurt" },
	baseUnit: "g" as const,
	nutrients: {
		energy: { kind: "value" as const, amount: 60 },
		protein: { kind: "value" as const, amount: 5 },
		carbs: { kind: "value" as const, amount: 4 },
		fat: { kind: "value" as const, amount: 3 },
		saturatedFat: { kind: "value" as const, amount: 2 },
		fibre: { kind: "absent" as const },
		sugars: { kind: "value" as const, amount: 4 },
		salt: { kind: "value" as const, amount: 0.1 },
	},
	provenance: {
		recordOrigin: "personal" as const,
		nutritionSource: "manual" as const,
		locallyEdited: true,
	},
	servings: [],
	createdAt: 1,
	updatedAt: 1,
};

jest.mock("../i18n", () => ({
	useI18n: () => ({ locale: "en" }),
	fmt: (value: string, values: Record<string, string>) =>
		value.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? ""),
}));
jest.mock("../data/personal-foods", () => ({
	usePersonalFoods: () => ({
		list: () => [mockPersonalFood],
		create: mockPersonalCreate,
	}),
}));
jest.mock("../data/nutrition-operation-service", () => ({
	mintNutritionUuid: () => "client-entry",
	useNutritionOperations: () => ({
		getSubject: () => "test-user",
		createBatch: mockCreateBatch,
		create: mockDiaryCreate,
	}),
}));
jest.mock("../ui/toast", () => ({
	useToast: () => ({ error: jest.fn(), success: jest.fn() }),
}));

describe("nutrition assistance screen", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockPersonalCreate.mockReturnValue(mockPersonalFood);
	});

	it("submits a reviewed text batch only once", () => {
		mockCreateBatch.mockImplementation(
			(_subject, _date, _meal, _entries, _onError, onSuccess) => {
				onSuccess?.();
				return "operation";
			},
		);
		render(
			<NutritionAssistanceScreen
				date="2026-09-12"
				meal="breakfast"
				onClose={jest.fn()}
			/>,
		);
		fireEvent.changeText(
			screen.getByLabelText("Text log"),
			"100 g Plain yoghurt",
		);
		fireEvent.press(screen.getByText("Parse text"));
		fireEvent.press(screen.getByText("Plain yoghurt · g"));
		fireEvent.press(screen.getByText("Review batch"));
		fireEvent.press(screen.getByText("Log reviewed batch"));
		fireEvent.press(screen.getByText("Log reviewed batch"));
		expect(mockCreateBatch).toHaveBeenCalledTimes(1);
		expect(
			screen.getByText("Batch saved on this device and queued for sync."),
		).toBeTruthy();
	});

	it("keeps the editable review when local batch acceptance fails", () => {
		mockCreateBatch.mockImplementation(() => {
			throw new Error("local failure");
		});
		render(
			<NutritionAssistanceScreen
				date="2026-09-12"
				meal="breakfast"
				onClose={jest.fn()}
			/>,
		);
		fireEvent.changeText(
			screen.getByLabelText("Text log"),
			"100 g Plain yoghurt",
		);
		fireEvent.press(screen.getByText("Parse text"));
		fireEvent.press(screen.getByText("Plain yoghurt · g"));
		fireEvent.press(screen.getByText("Review batch"));
		fireEvent.press(screen.getByText("Log reviewed batch"));
		expect(screen.getByText("Log reviewed batch")).toBeTruthy();
		expect(
			screen.getAllByDisplayValue("100 g Plain yoghurt").length,
		).toBeGreaterThan(0);
	});

	it("reuses the reviewed personal food if diary acceptance fails and the form is retried", () => {
		mockDiaryCreate.mockImplementation((_subject, _entry, _hint, onError) => {
			onError?.(new Error("local failure"));
			return "operation";
		});
		render(
			<NutritionAssistanceScreen
				date="2026-09-12"
				meal="breakfast"
				onClose={jest.fn()}
			/>,
		);
		fireEvent.press(screen.getByText("Pasted label"));
		fireEvent.changeText(
			screen.getByLabelText("Review a pasted nutrition label"),
			"Name: Plain yoghurt\nPer 100 g\nEnergy 250 kcal",
		);
		fireEvent.press(screen.getByText("Parse label"));
		fireEvent.press(screen.getByText("Save food and log portion"));
		fireEvent.press(screen.getByText("Save food and log portion"));
		expect(mockPersonalCreate).toHaveBeenCalledTimes(1);
		expect(screen.getByText("Save food and log portion")).toBeTruthy();
	});
});
