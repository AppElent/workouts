import { useI18n } from "../../../i18n";
import { Segmented } from "../../../ui/segmented";

export type FoodAuthoringKind = "personal" | "recipe" | "oneOff";

export function FoodAuthoringTabs({
	value,
	onChange,
}: {
	value: FoodAuthoringKind;
	onChange: (value: FoodAuthoringKind) => void;
}) {
	const { t } = useI18n();
	const labels = t.nutrition.foodEditor.authoring;

	return (
		<Segmented
			value={value}
			onChange={onChange}
			options={[
				{ value: "personal", label: labels.personal },
				{ value: "recipe", label: labels.recipe },
				{ value: "oneOff", label: labels.oneOff },
			]}
		/>
	);
}
