import { EQUIPMENT, MUSCLE_GROUP_KEYS } from "@foundry/core";
import { Modal } from "react-native";
import {
	modalAnimation,
	useReduceMotion,
} from "../../../feedback/reduce-motion";
import { plural, useI18n } from "../../../i18n";
import {
	FormChoiceRow,
	FormScreen,
	FormSection,
	FormSegmentedRow,
	TextAction,
} from "../../../ui/form";
import { emptyFilters, type Filters, toggleChoice } from "./exercise-filters";
import { MuscleIcon } from "./muscle-icon";
export function ExerciseFiltersSheet({
	draft,
	onChange,
	count,
	onApply,
	onCancel,
}: {
	draft: Filters;
	onChange: (next: Filters) => void;
	count: number;
	onApply: () => void;
	onCancel: () => void;
}) {
	const { t, locale } = useI18n();
	const c = t.exercises;
	const reduceMotion = useReduceMotion();
	return (
		<Modal
			visible
			presentationStyle="pageSheet"
			animationType={modalAnimation(reduceMotion, "slide")}
			onRequestClose={onCancel}
			allowSwipeDismissal
		>
			<FormScreen
				title={c.filters}
				cancelLabel={c.cancel}
				onCancel={onCancel}
				primaryAction={{
					label: plural(locale, count, c.apply),
					onPress: onApply,
				}}
			>
				<TextAction label={c.reset} onPress={() => onChange(emptyFilters())} />
				<FormSection title={c.groups} footer={c.multiple}>
					{MUSCLE_GROUP_KEYS.map((group) => (
						<FormChoiceRow
							key={group}
							label={c.groupNames[group]}
							leading={<MuscleIcon group={group} size={36} />}
							selected={draft.groups.includes(group)}
							onPress={() =>
								onChange({
									...draft,
									groups: toggleChoice(draft.groups, group),
								})
							}
						/>
					))}
				</FormSection>
				<FormSection title={c.equipment} footer={c.multiple}>
					{EQUIPMENT.map((equipment) => (
						<FormChoiceRow
							key={equipment}
							label={c.equipmentNames[equipment]}
							selected={draft.equipment.includes(equipment)}
							onPress={() =>
								onChange({
									...draft,
									equipment: toggleChoice(draft.equipment, equipment),
								})
							}
						/>
					))}
				</FormSection>
				<FormSection title={c.movement}>
					<FormSegmentedRow
						value={draft.category}
						onChange={(category) => onChange({ ...draft, category })}
						options={[
							{ value: "all", label: c.any },
							{ value: "compound", label: c.compound },
							{ value: "isolation", label: c.isolation },
						]}
					/>
				</FormSection>
			</FormScreen>
		</Modal>
	);
}
