import { Modal } from "react-native";
import { modalAnimation, useReduceMotion } from "../../feedback/reduce-motion";
import { useI18n } from "../../i18n";
import {
	FormChoiceRow,
	FormScreen,
	FormSection,
	FormSegmentedRow,
	TextAction,
} from "../../ui/form";
import { MuscleIcon } from "../../ui/muscle-icon";
import {
	EQUIPMENT,
	emptyFilters,
	type Filters,
	GROUP_KEYS,
	toggleChoice,
} from "./model";
export function FiltersSheet({
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
	const { t } = useI18n();
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
					label: (count === 1 ? c.applyOne : c.apply).replace(
						"{count}",
						String(count),
					),
					onPress: onApply,
				}}
			>
				<TextAction label={c.reset} onPress={() => onChange(emptyFilters())} />
				<FormSection title={c.groups} footer={c.multiple}>
					{GROUP_KEYS.map((group) => (
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
