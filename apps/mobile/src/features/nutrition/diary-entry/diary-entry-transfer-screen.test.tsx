import { act, fireEvent, screen } from "@testing-library/react-native";
import { Stack } from "expo-router";
import { renderRouter } from "expo-router/testing-library";
import { SafeAreaProvider } from "react-native-safe-area-context";
import type {
	DiaryEntry,
	DiaryEntryWithMeal,
} from "../../../data/nutrition-day";
import { useNutritionDiary } from "../../../data/nutrition-diary";
import { useI18n } from "../../../i18n";
import { en } from "../../../i18n/messages/en";
import { nl } from "../../../i18n/messages/nl";
import { pressPending } from "../../../test-support/press-pending";
import { AppearanceProvider } from "../../../theme";
import { useToast } from "../../../ui/toast";
import {
	copiedEntrySnapshot,
	DiaryEntryTransferScreen,
} from "./diary-entry-transfer-screen";

jest.mock("../../../data/nutrition-diary", () => ({
	useNutritionDiary: jest.fn(),
}));
jest.mock("../../../feedback/reduce-motion", () => ({
	modalAnimation: () => "none",
	useReduceMotion: () => false,
}));
jest.mock("../../../i18n", () => ({
	...jest.requireActual("../../../i18n"),
	useI18n: jest.fn(),
}));
jest.mock("../../../ui/toast", () => ({ useToast: jest.fn() }));

const mockUseNutritionDiary = jest.mocked(useNutritionDiary);
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

async function renderTransfer(
	mode: "copy" | "move",
	diary: Record<string, jest.Mock>,
	overrides: Partial<DiaryEntry> = {},
	locale: "en" | "nl" = "en",
	entries?: readonly DiaryEntryWithMeal[],
) {
	const toast = { error: jest.fn(), success: jest.fn() };
	mockUseI18n.mockReturnValue({
		locale,
		t: locale === "nl" ? nl : en,
		setLocale: jest.fn(),
	} as never);
	mockUseToast.mockReturnValue(toast);
	mockUseNutritionDiary.mockReturnValue(diary as never);
	const onClose = jest.fn();
	await renderRouter(
		{
			index: () => (
				<SafeAreaProvider
					initialMetrics={{
						frame: { x: 0, y: 0, width: 390, height: 844 },
						insets: { top: 0, right: 0, bottom: 0, left: 0 },
					}}
				>
					<DiaryEntryTransferScreen
						entry={{ ...entry, ...overrides }}
						entries={entries}
						date="2026-09-12"
						meal={entries ? undefined : "lunch"}
						mode={mode}
						onClose={onClose}
					/>
				</SafeAreaProvider>
			),
			_layout: () => (
				<AppearanceProvider>
					<Stack />
				</AppearanceProvider>
			),
		},
		{ initialUrl: "/" },
	);
	return { onClose, toast };
}

describe("DiaryEntryTransferScreen", () => {
	it("defaults a batch move to its source meal and blocks an unchanged destination", async () => {
		const move = jest.fn();
		await renderTransfer("move", { move }, {}, "en", [
			{ ...entry, meal: "dinner" },
			{ ...entry, id: "entry-2", meal: "dinner" },
		]);
		expect(screen.getByRole("radio", { name: "Dinner" })).toBeSelected();
		expect(screen.getByLabelText("Move entry")).toBeDisabled();
		await fireEvent.press(screen.getByLabelText("Move entry"));
		expect(move).not.toHaveBeenCalled();
	});
	it("moves a mixed-meal selection together without mistaking it for an unchanged move", async () => {
		const move = jest.fn(async () => {});
		await renderTransfer("move", { move }, {}, "en", [
			{ ...entry, meal: "lunch" },
			{ ...entry, id: "entry-2", meal: "dinner" },
		]);
		expect(screen.getByLabelText("Move entry")).toBeEnabled();
		await fireEvent.press(screen.getByLabelText("Move entry"));
		expect(move).toHaveBeenCalledWith(
			[
				{ kind: "serverId", id: "entry-1" },
				{ kind: "serverId", id: "entry-2" },
			],
			"2026-09-12",
			"lunch",
		);
	});
	it("creates a fresh, ungrouped snapshot at the selected destination", async () => {
		const logBatch = jest.fn(
			async (_date: string, _meal: string, _entries: unknown[]) => ({
				clientEntryIds: [],
				undo: jest.fn(),
			}),
		);
		const { onClose } = await renderTransfer("copy", {
			logBatch,
			move: jest.fn(),
		});

		await fireEvent.press(screen.getByText("Dinner"));
		await fireEvent.press(screen.getByLabelText("Sunday 13 September"));
		await fireEvent.press(screen.getByLabelText("Copy entry"));

		expect(logBatch).toHaveBeenCalledWith("2026-09-13", "dinner", [
			expect.objectContaining({
				date: "2026-09-13",
				meal: "dinner",
				serving: entry.serving,
				nutrients: entry.nutrients,
				provenance: entry.provenance,
			}),
		]);
		const [copied] = (logBatch.mock.calls[0]?.[2] ?? []) as {
			comboGroup?: unknown;
		}[];
		expect(copied?.comboGroup).toBeUndefined();
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("moves the entry with one atomic batch", async () => {
		const move = jest.fn(async () => {});
		await renderTransfer(
			"move",
			{ logBatch: jest.fn(), move },
			{ id: "entry-9" },
		);

		await fireEvent.press(screen.getByText("Dinner"));
		await fireEvent.press(screen.getByLabelText("Sunday 13 September"));
		await fireEvent.press(screen.getByLabelText("Move entry"));

		expect(move).toHaveBeenCalledWith(
			[{ kind: "serverId", id: "entry-9" }],
			"2026-09-13",
			"dinner",
		);
	});

	it("blocks an unchanged move", async () => {
		const move = jest.fn();
		await renderTransfer("move", { logBatch: jest.fn(), move });

		await fireEvent.press(screen.getByLabelText("Move entry"));
		expect(move).not.toHaveBeenCalled();
	});

	it("localizes the expanded calendar controls for Dutch", async () => {
		await renderTransfer(
			"copy",
			{ logBatch: jest.fn(), move: jest.fn() },
			{},
			"nl",
		);

		expect(screen.getByLabelText("Tussendoortjes")).toBeTruthy();
		await fireEvent.press(screen.getByLabelText("Kies doeldatum"));
		expect(screen.getByLabelText("Vorige maand")).toBeTruthy();
		expect(screen.getByLabelText("Volgende maand")).toBeTruthy();
		expect(screen.getByLabelText("Vandaag")).toBeTruthy();
	});

	it("blocks a synchronous double submit and keeps the destination after failure", async () => {
		let fail!: (error: unknown) => void;
		const logBatch = jest.fn(
			() =>
				new Promise((_resolve, reject) => {
					fail = reject;
				}),
		);
		const { toast } = await renderTransfer("copy", {
			logBatch,
			move: jest.fn(),
		});
		await fireEvent.press(screen.getByText("Dinner"));
		await fireEvent.press(screen.getByLabelText("Sunday 13 September"));
		const copyButton = screen.getByLabelText("Copy entry");
		await pressPending(copyButton);
		await pressPending(copyButton);
		expect(logBatch).toHaveBeenCalledTimes(1);

		await act(async () => fail(new Error("offline")));
		expect(toast.error).toHaveBeenCalledWith(
			"This entry could not be copied. Your destination is still here.",
		);
		expect(screen.getByText("Dinner")).toBeTruthy();

		await pressPending(screen.getByLabelText("Copy entry"));
		expect(logBatch).toHaveBeenCalledTimes(2);
	});

	it("strips any source combo group from a copy", () => {
		const copied = copiedEntrySnapshot(entry, "2026-09-13", "dinner");
		expect(copied).toEqual(
			expect.objectContaining({
				date: "2026-09-13",
				meal: "dinner",
				serving: entry.serving,
				nutrients: entry.nutrients,
				provenance: entry.provenance,
			}),
		);
		expect(copied.comboGroup).toBeUndefined();
		expect("id" in copied).toBe(false);
	});
});
