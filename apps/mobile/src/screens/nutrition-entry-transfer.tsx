/**
 * Copy or move selected diary entries without changing their snapshots.
 *
 * A copy is a fresh, immutable diary snapshot. A move is intentionally a
 * single batch operation: it retains the entries' identities and lets the local
 * projection move it atomically between the two day/meal views.
 */
import type { NutritionDiarySnapshot } from "@workouts/core";
import { useRef, useState } from "react";
import { Modal } from "react-native";
import type {
	DiaryEntry,
	DiaryEntryWithMeal,
	MealSlot,
} from "../data/nutrition-day";
import { MEAL_SLOTS } from "../data/nutrition-day";
import {
	mintNutritionUuid,
	snapshotFromDiaryEntry,
	useNutritionOperations,
} from "../data/nutrition-operation-service";
import { modalAnimation, useReduceMotion } from "../feedback/reduce-motion";
import { useI18n } from "../i18n";
import { convexErrorMessage } from "../ui/confirm-dialog";
import { DateStepper } from "../ui/date-stepper";
import { FormScreen, FormSection, FormSegmentedRow } from "../ui/form";
import { NutritionCalendar } from "../ui/nutrition-calendar";
import { AppText } from "../ui/text";
import { useToast } from "../ui/toast";

type TransferMode = "copy" | "move";

type TransferCopy = {
	title: string;
	intro: string;
	destinationDate: string;
	destinationMeal: string;
	chooseDate: string;
	cancel: string;
	submit: string;
	pending: string;
	failure: string;
};

const CALENDAR_LABELS = {
	en: {
		previousMonth: "Previous month",
		nextMonth: "Next month",
		today: "Today",
		selected: "Selected",
	},
	nl: {
		previousMonth: "Vorige maand",
		nextMonth: "Volgende maand",
		today: "Vandaag",
		selected: "Geselecteerd",
	},
} as const;

function transferCopy(mode: TransferMode, locale: "en" | "nl"): TransferCopy {
	if (locale === "nl") {
		return mode === "copy"
			? {
					title: "Item kopiëren",
					intro: "Kies waar je een nieuwe kopie van dit item wilt toevoegen.",
					destinationDate: "Doeldatum",
					destinationMeal: "Doelmaaltijd",
					chooseDate: "Kies doeldatum",
					cancel: "Annuleren",
					submit: "Item kopiëren",
					pending: "Kopiëren…",
					failure:
						"Dit item kon niet worden gekopieerd. Je bestemming staat er nog.",
				}
			: {
					title: "Item verplaatsen",
					intro: "Kies waar je dit item wilt verplaatsen.",
					destinationDate: "Doeldatum",
					destinationMeal: "Doelmaaltijd",
					chooseDate: "Kies doeldatum",
					cancel: "Annuleren",
					submit: "Item verplaatsen",
					pending: "Verplaatsen…",
					failure:
						"Dit item kon niet worden verplaatst. Je bestemming staat er nog.",
				};
	}

	return mode === "copy"
		? {
				title: "Copy entry",
				intro: "Choose where to add a new copy of this entry.",
				destinationDate: "Destination date",
				destinationMeal: "Destination meal",
				chooseDate: "Choose destination date",
				cancel: "Cancel",
				submit: "Copy entry",
				pending: "Copying…",
				failure:
					"This entry could not be copied. Your destination is still here.",
			}
		: {
				title: "Move entry",
				intro: "Choose where to move this entry.",
				destinationDate: "Destination date",
				destinationMeal: "Destination meal",
				chooseDate: "Choose destination date",
				cancel: "Cancel",
				submit: "Move entry",
				pending: "Moving…",
				failure:
					"This entry could not be moved. Your destination is still here.",
			};
}

/**
 * Snapshots intentionally do not carry a Combo group. Copying a single part
 * must not join it to the original group's lifecycle or presentation.
 */
export function copiedEntrySnapshot(
	entry: DiaryEntry,
	date: string,
	meal: MealSlot,
	clientEntryId: string,
): NutritionDiarySnapshot & { clientEntryId: string } {
	const {
		comboGroup: _comboGroup,
		clientEntryId: _sourceClientEntryId,
		...snapshot
	} = snapshotFromDiaryEntry(entry, date, meal);
	return { ...snapshot, date, meal, clientEntryId };
}

function updateTarget(entry: DiaryEntry) {
	return entry.id.startsWith("client:")
		? { kind: "clientEntryId" as const, id: entry.id.slice("client:".length) }
		: { kind: "serverId" as const, id: entry.id };
}

export function NutritionEntryTransfer({
	entry,
	entries,
	date,
	meal,
	mode,
	onClose,
}: {
	entry?: DiaryEntry;
	entries?: readonly DiaryEntryWithMeal[];
	date: string;
	meal?: MealSlot;
	mode: TransferMode;
	onClose: () => void;
}) {
	const { locale, t } = useI18n();
	const toast = useToast();
	const operations = useNutritionOperations();
	const reduceMotion = useReduceMotion();
	// The sheet belongs to the account that opened it. The provider normally
	// unmounts account-bound views on a switch, but this guard also prevents a
	// stale native sheet from accepting a previous person's entry.
	const [sourceSubject] = useState(() => operations.getSubject());
	const copy = transferCopy(mode, locale);
	const selectedEntries = entries ?? (entry ? [entry] : []);
	const primary = selectedEntries[0] ?? entry;
	const sourceMeal = meal ?? entries?.[0]?.meal ?? "breakfast";
	const [destinationDate, setDestinationDate] = useState(date);
	const [destinationMeal, setDestinationMeal] = useState<MealSlot>(sourceMeal);
	const [showCalendar, setShowCalendar] = useState(false);
	const [saving, setSaving] = useState(false);
	const submitLock = useRef(false);
	if (!primary) return null;
	const unchanged =
		mode === "move" &&
		destinationDate === date &&
		(entries
			? entries.every((item) => item.meal === destinationMeal)
			: destinationMeal === sourceMeal);

	const releaseAfterFailure = (error: unknown) => {
		submitLock.current = false;
		setSaving(false);
		toast.error(convexErrorMessage(error, copy.failure));
	};

	const accepted = () => {
		setSaving(false);
		onClose();
	};

	const submit = () => {
		if (saving || submitLock.current || unchanged) return;
		submitLock.current = true;
		setSaving(true);
		try {
			const subject = operations.getSubject();
			if (!sourceSubject || subject !== sourceSubject)
				throw new Error("Nutrition account changed.");

			if (mode === "copy") {
				operations.createBatch(
					subject,
					destinationDate,
					destinationMeal,
					selectedEntries.map((item) =>
						copiedEntrySnapshot(
							item,
							destinationDate,
							destinationMeal,
							mintNutritionUuid(),
						),
					),
					releaseAfterFailure,
					accepted,
				);
				return;
			}

			operations.moveBatch(
				subject,
				selectedEntries.map(updateTarget),
				destinationDate,
				destinationMeal,
				releaseAfterFailure,
				accepted,
			);
		} catch (error) {
			releaseAfterFailure(error);
		}
	};

	const requestClose = () => {
		if (!saving) onClose();
	};

	return (
		<Modal
			visible
			presentationStyle="pageSheet"
			allowSwipeDismissal={!saving}
			animationType={modalAnimation(reduceMotion, "slide")}
			onRequestClose={requestClose}
		>
			<FormScreen
				title={copy.title}
				cancelLabel={copy.cancel}
				onCancel={saving ? undefined : requestClose}
				primaryAction={{
					label: saving ? copy.pending : copy.submit,
					accessibilityLabel: copy.submit,
					onPress: submit,
					loading: saving,
					disabled: saving || unchanged,
				}}
			>
				<AppText variant="heading">
					{selectedEntries.length === 1
						? primary.name[locale]
						: `${selectedEntries.length} items`}
				</AppText>
				<AppText variant="caption">{copy.intro}</AppText>
				<FormSection title={copy.destinationMeal}>
					<FormSegmentedRow
						options={MEAL_SLOTS.map((slot) => ({
							value: slot,
							label: t.nutrition.meals[slot],
						}))}
						value={destinationMeal}
						onChange={setDestinationMeal}
					/>
				</FormSection>
				<FormSection title={copy.destinationDate}>
					<DateStepper
						date={destinationDate}
						locale={locale}
						previousLabel={t.nutrition.day.previousDay}
						nextLabel={t.nutrition.day.nextDay}
						onChange={setDestinationDate}
						onChooseDate={() => setShowCalendar((shown) => !shown)}
						chooseDateLabel={copy.chooseDate}
					/>
					{showCalendar ? (
						<NutritionCalendar
							selectedDate={destinationDate}
							locale={locale}
							labels={CALENDAR_LABELS[locale]}
							onSelect={(nextDate) => {
								setDestinationDate(nextDate);
								setShowCalendar(false);
							}}
						/>
					) : null}
				</FormSection>
			</FormScreen>
		</Modal>
	);
}
