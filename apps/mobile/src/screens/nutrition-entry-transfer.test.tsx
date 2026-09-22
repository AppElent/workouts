import { act, fireEvent, screen } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import type {
	DiaryEntry,
	DiaryEntryWithMeal,
	MealSlot,
} from "../data/nutrition-day";
import {
	mintNutritionUuid,
	snapshotFromDiaryEntry,
	useNutritionOperations,
} from "../data/nutrition-operation-service";
import { useI18n } from "../i18n";
import { renderThemed as render } from "../test-support/render-themed";
import { useToast } from "../ui/toast";
import {
	copiedEntrySnapshot,
	NutritionEntryTransfer,
} from "./nutrition-entry-transfer";

jest.mock("../data/nutrition-operation-service", () => ({
	mintNutritionUuid: jest.fn(),
	snapshotFromDiaryEntry: jest.fn(),
	useNutritionOperations: jest.fn(),
}));
jest.mock("../feedback/reduce-motion", () => ({
	modalAnimation: () => "none",
	useReduceMotion: () => false,
}));
jest.mock("../i18n", () => ({ useI18n: jest.fn() }));
jest.mock("../ui/toast", () => ({ useToast: jest.fn() }));

const mockMintNutritionUuid = jest.mocked(mintNutritionUuid);
const mockSnapshotFromDiaryEntry = jest.mocked(snapshotFromDiaryEntry);
const mockUseNutritionOperations = jest.mocked(useNutritionOperations);
const mockUseI18n = jest.mocked(useI18n);
const mockUseToast = jest.mocked(useToast);

const entry: DiaryEntry = {
	id: "entry-1",
	name: { en: "Apple", nl: "Appel" },
	serving: { en: "Piece × 1", nl: "Stuk × 1" },
	quantity: 1,
	amount: 135,
	baseUnit: "g",
	provenance: { source: "oneOff" },
	comboGroup: { id: "old-group", comboId: "combo-1", name: "Breakfast" },
	nutrients: {
		energy: { kind: "value", amount: 76 },
		protein: { kind: "value", amount: 0.3 },
		carbs: { kind: "value", amount: 15 },
		fat: { kind: "value", amount: 0.2 },
		saturatedFat: { kind: "value", amount: 0.1 },
		fibre: { kind: "value", amount: 2.7 },
		sugars: { kind: "value", amount: 13.5 },
		salt: { kind: "value", amount: 0.01 },
	},
};

function snapshot(source: DiaryEntry, date: string, meal: MealSlot) {
	return {
		date,
		meal,
		name: source.name,
		serving: source.serving,
		quantity: source.quantity,
		amount: source.amount,
		baseUnit: source.baseUnit,
		nutrients: source.nutrients,
		provenance: source.provenance,
		...(source.comboGroup ? { comboGroup: source.comboGroup } : {}),
		...(source.id.startsWith("client:")
			? { clientEntryId: source.id.slice("client:".length) }
			: {}),
	};
}

function renderTransfer(
	mode: "copy" | "move",
	operations: Record<string, jest.Mock>,
	overrides: Partial<DiaryEntry> = {},
	locale: "en" | "nl" = "en",
	entries?: readonly DiaryEntryWithMeal[],
) {
	const toast = { error: jest.fn(), success: jest.fn() };
	const dutch = locale === "nl";
	mockUseI18n.mockReturnValue({
		locale,
		t: {
			nutrition: {
				meals: {
					breakfast: dutch ? "Ontbijt" : "Breakfast",
					lunch: "Lunch",
					dinner: dutch ? "Diner" : "Dinner",
					snacks: dutch ? "Tussendoortjes" : "Snacks",
				},
				day: {
					previousDay: dutch ? "Vorige dag" : "Previous day",
					nextDay: dutch ? "Volgende dag" : "Next day",
				},
			},
		},
		setLocale: jest.fn(),
	} as never);
	mockUseToast.mockReturnValue(toast);
	mockUseNutritionOperations.mockReturnValue(operations as never);
	const onClose = jest.fn();
	render(
		<SafeAreaProvider
			initialMetrics={{
				frame: { x: 0, y: 0, width: 390, height: 844 },
				insets: { top: 0, right: 0, bottom: 0, left: 0 },
			}}
		>
			<NutritionEntryTransfer
				entry={{ ...entry, ...overrides }}
				entries={entries}
				date="2026-09-12"
				meal={entries ? undefined : "lunch"}
				mode={mode}
				onClose={onClose}
			/>
		</SafeAreaProvider>,
	);
	return { onClose, toast };
}

beforeEach(() => {
	mockMintNutritionUuid.mockReturnValue("new-client-id");
	mockSnapshotFromDiaryEntry.mockImplementation(snapshot);
});

describe("NutritionEntryTransfer", () => {
	it("defaults a batch move to its source meal and blocks an unchanged destination", () => {
		const moveBatch = jest.fn();
		renderTransfer(
			"move",
			{ getSubject: jest.fn(() => "account-a"), moveBatch },
			{},
			"en",
			[
				{ ...entry, meal: "dinner" },
				{ ...entry, id: "entry-2", meal: "dinner" },
			],
		);
		expect(screen.getByRole("radio", { name: "Dinner" })).toBeSelected();
		expect(screen.getByLabelText("Move entry")).toBeDisabled();
		fireEvent.press(screen.getByLabelText("Move entry"));
		expect(moveBatch).not.toHaveBeenCalled();
	});
	it("moves a mixed-meal selection together without mistaking it for an unchanged move", () => {
		const moveBatch = jest.fn();
		renderTransfer(
			"move",
			{ getSubject: jest.fn(() => "account-a"), moveBatch },
			{},
			"en",
			[
				{ ...entry, meal: "lunch" },
				{ ...entry, id: "client:pending-entry", meal: "dinner" },
			],
		);
		expect(screen.getByLabelText("Move entry")).toBeEnabled();
		fireEvent.press(screen.getByLabelText("Move entry"));
		expect(moveBatch).toHaveBeenCalledWith(
			"account-a",
			[
				{ kind: "serverId", id: "entry-1" },
				{ kind: "clientEntryId", id: "pending-entry" },
			],
			"2026-09-12",
			"lunch",
			expect.any(Function),
			expect.any(Function),
		);
	});
	it("creates a fresh, ungrouped snapshot at the selected destination", () => {
		const createBatch = jest.fn(
			(
				_subject: string,
				_date: string,
				_meal: MealSlot,
				_snapshots: unknown[],
				_error: unknown,
				onSuccess: () => void,
			) => onSuccess(),
		);
		const { onClose } = renderTransfer("copy", {
			getSubject: jest.fn(() => "account-a"),
			createBatch,
			moveBatch: jest.fn(),
		});

		fireEvent.press(screen.getByText("Dinner"));
		fireEvent.press(screen.getByLabelText("Next day"));
		fireEvent.press(screen.getByLabelText("Copy entry"));

		expect(createBatch).toHaveBeenCalledWith(
			"account-a",
			"2026-09-13",
			"dinner",
			[
				expect.objectContaining({
					clientEntryId: "new-client-id",
					date: "2026-09-13",
					meal: "dinner",
					serving: entry.serving,
					nutrients: entry.nutrients,
					provenance: entry.provenance,
				}),
			],
			expect.any(Function),
			expect.any(Function),
		);
		const copied = createBatch.mock.calls[0]?.[3][0] as {
			comboGroup?: unknown;
		};
		expect(copied.comboGroup).toBeUndefined();
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("moves the existing local entry with one normalized atomic batch", () => {
		const moveBatch = jest.fn(
			(
				_subject: string,
				_targets: unknown[],
				_date: string,
				_meal: MealSlot,
				_error: unknown,
				onSuccess: () => void,
			) => onSuccess(),
		);
		renderTransfer(
			"move",
			{
				getSubject: jest.fn(() => "account-a"),
				createBatch: jest.fn(),
				moveBatch,
			},
			{ id: "client:offline-entry" },
		);

		fireEvent.press(screen.getByText("Dinner"));
		fireEvent.press(screen.getByLabelText("Next day"));
		fireEvent.press(screen.getByLabelText("Move entry"));

		expect(moveBatch).toHaveBeenCalledWith(
			"account-a",
			[{ kind: "clientEntryId", id: "offline-entry" }],
			"2026-09-13",
			"dinner",
			expect.any(Function),
			expect.any(Function),
		);
	});

	it("blocks an unchanged move", () => {
		const moveBatch = jest.fn();
		renderTransfer("move", {
			getSubject: jest.fn(() => "account-a"),
			createBatch: jest.fn(),
			moveBatch,
		});

		fireEvent.press(screen.getByLabelText("Move entry"));
		expect(moveBatch).not.toHaveBeenCalled();
	});

	it("does not transfer an entry after its source account changes", () => {
		const getSubject = jest
			.fn()
			.mockReturnValueOnce("account-a")
			.mockReturnValue("account-b");
		const createBatch = jest.fn();
		const { toast } = renderTransfer("copy", {
			getSubject,
			createBatch,
			moveBatch: jest.fn(),
		});

		fireEvent.press(screen.getByText("Dinner"));
		fireEvent.press(screen.getByLabelText("Copy entry"));

		expect(createBatch).not.toHaveBeenCalled();
		expect(toast.error).toHaveBeenCalledWith("Nutrition account changed.");
	});

	it("localizes the expanded calendar controls for Dutch", () => {
		renderTransfer(
			"copy",
			{
				getSubject: jest.fn(() => "account-a"),
				createBatch: jest.fn(),
				moveBatch: jest.fn(),
			},
			{},
			"nl",
		);

		expect(screen.getByText("Tussendoortjes")).toBeTruthy();
		fireEvent.press(screen.getByLabelText("Kies doeldatum"));
		expect(screen.getByLabelText("Vorige maand")).toBeTruthy();
		expect(screen.getByLabelText("Volgende maand")).toBeTruthy();
		expect(screen.getByLabelText("Vandaag")).toBeTruthy();
	});

	it("blocks a synchronous double submit and keeps the destination after failure", () => {
		let fail!: (error: unknown) => void;
		const createBatch = jest.fn(
			(
				_subject: string,
				_date: string,
				_meal: MealSlot,
				_snapshots: unknown[],
				onError: (error: unknown) => void,
			) => {
				fail = onError;
			},
		);
		const operations = {
			getSubject: jest.fn(() => "account-a"),
			createBatch,
			moveBatch: jest.fn(),
		};
		const { toast } = renderTransfer("copy", operations);
		fireEvent.press(screen.getByText("Dinner"));
		fireEvent.press(screen.getByLabelText("Next day"));
		const copyButton = screen.getByLabelText("Copy entry");
		fireEvent.press(copyButton);
		fireEvent.press(copyButton);
		expect(createBatch).toHaveBeenCalledTimes(1);

		act(() => fail("offline"));
		expect(toast.error).toHaveBeenCalledWith(
			"This entry could not be copied. Your destination is still here.",
		);
		expect(screen.getByText("Dinner")).toBeTruthy();
		expect(mockSnapshotFromDiaryEntry).toHaveBeenLastCalledWith(
			expect.objectContaining({ id: "entry-1" }),
			"2026-09-13",
			"dinner",
		);

		fireEvent.press(screen.getByLabelText("Copy entry"));
		expect(createBatch).toHaveBeenCalledTimes(2);
	});

	it("strips any source combo group even when the snapshot helper supplies one", () => {
		expect(
			copiedEntrySnapshot(entry, "2026-09-13", "dinner", "new-client-id"),
		).toEqual(
			expect.objectContaining({
				clientEntryId: "new-client-id",
				date: "2026-09-13",
				meal: "dinner",
				serving: entry.serving,
				nutrients: entry.nutrients,
				provenance: entry.provenance,
			}),
		);
		expect(
			copiedEntrySnapshot(entry, "2026-09-13", "dinner", "new-client-id")
				.comboGroup,
		).toBeUndefined();
	});
});
