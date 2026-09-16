import { useI18n } from "../../../../src/i18n";
import { CoachTabStack } from "../../../../src/ui/coach-tab-stack";

export default function TrainTabLayout() {
	const { t } = useI18n();
	return <CoachTabStack title={t.tabs.train} />;
}
