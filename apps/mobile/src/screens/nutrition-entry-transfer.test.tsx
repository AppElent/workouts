import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import type { DiaryEntry, MealSlot } from "../data/nutrition-day";
import {
	mintNutritionUuid,
	snapshotFromDiaryEntry,
	useNutritionOperations,
} from "../data/nutrition-operation-service";
import { useI18n } from "../i18n";
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
				date="2026-09-12"
				meal="lunch"
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
	it("creates a fresh, ungrouped snapshot at the selected destination", () => {
		const create = jest.fn(
			(
				_subject: string,
				_snapshot: unknown,
				_direct: unknown,
				_error: unknown,
				onSuccess: () => void,
			) => onSuccess(),
		);
		const { onClose } = renderTransfer("copy", {
			getSubject: jest.fn(() => "account-a"),
			create,
			update: jest.fn(),
		});

		fireEvent.press(screen.getByText("Dinner"));
		fireEvent.press(screen.getByLabelText("Next day"));
		fireEvent.press(screen.getByLabelText("Copy entry"));

		expect(create).toHaveBeenCalledWith(
			"account-a",
			expect.objectContaining({
				clientEntryId: "new-client-id",
				date: "2026-09-13",
				meal: "dinner",
				serving: entry.serving,
				nutrients: entry.nutrients,
				provenance: entry.provenance,
			}),
			undefined,
			expect.any(Function),
			expect.any(Function),
		);
		const copied = create.mock.calls[0]?.[1] as { comboGroup?: unknown };
		expect(copied.comboGroup).toBeUndefined();
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("moves the existing local entry with one normalized atomic update", () => {
		const update = jest.fn(
			(
				_subject: string,
				_target: unknown,
				_patch: unknown,
				_hint: unknown,
				_error: unknown,
				onSuccess: () => void,
			) => onSuccess(),
		);
		renderTransfer(
			"move",
			{
				getSubject: jest.fn(() => "account-a"),
				create: jest.fn(),
				update,
			},
			{ id: "client:offline-entry" },
		);

		fireEvent.press(screen.getByText("Dinner"));
		fireEvent.press(screen.getByLabelText("Next day"));
		fireEvent.press(screen.getByLabelText("Move entry"));

		expect(update).toHaveBeenCalledWith(
			"account-a",
			{ kind: "clientEntryId", id: "offline-entry" },
			{ date: "2026-09-13", meal: "dinner" },
			expect.objectContaining({
				targetEntry: expect.objectContaining({
					_id: "client:offline-entry",
					date: "2026-09-12",
					meal: "lunch",
					comboGroup: entry.comboGroup,
				}),
			}),
			expect.any(Function),
			expect.any(Function),
		);
	});

	it("blocks an unchanged move", () => {
		const update = jest.fn();
		renderTransfer("move", {
			getSubject: jest.fn(() => "account-a"),
			create: jest.fn(),
			update,
		});

		fireEvent.press(screen.getByLabelText("Move entry"));
		expect(update).not.toHaveBeenCalled();
	});

	it("does not transfer an entry after its source account changes", () => {
		const getSubject = jest
			.fn()
			.mockReturnValueOnce("account-a")
			.mockReturnValue("account-b");
		const create = jest.fn();
		const { toast } = renderTransfer("copy", {
			getSubject,
			create,
			update: jest.fn(),
		});

		fireEvent.press(screen.getByText("Dinner"));
		fireEvent.press(screen.getByLabelText("Copy entry"));

		expect(create).not.toHaveBeenCalled();
		expect(toast.error).toHaveBeenCalledWith("Nutrition account changed.");
	});

	it("localizes the expanded calendar controls for Dutch", () => {
		renderTransfer(
			"copy",
			{
				getSubject: jest.fn(() => "account-a"),
				create: jest.fn(),
				update: jest.fn(),
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
		const create = jest.fn(
			(
				_subject: string,
				_snapshot: unknown,
				_direct: unknown,
				onError: (error: unknown) => void,
			) => {
				fail = onError;
			},
		);
		const operations = {
			getSubject: jest.fn(() => "account-a"),
			create,
			update: jest.fn(),
		};
		const { toast } = renderTransfer("copy", operations);
		fireEvent.press(screen.getByText("Dinner"));
		fireEvent.press(screen.getByLabelText("Next day"));
		const copyButton = screen.getByLabelText("Copy entry");
		fireEvent.press(copyButton);
		fireEvent.press(copyButton);
		expect(create).toHaveBeenCalledTimes(1);

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
		expect(create).toHaveBeenCalledTimes(2);
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
