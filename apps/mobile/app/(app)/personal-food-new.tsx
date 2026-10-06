/**
 * A new Personal Food or recipe, as a sheet with ✕ and ✓. With `barcode` it
 * starts from the Open Food Facts product, reviewed before it is saved.
 */
import type { PersonalFoodDraft } from "@workouts/core/nutrition";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { useOpenFoodFacts } from "../../src/data/open-food-facts-context";
import { useI18n } from "../../src/i18n";
import { PersonalFoodEditor } from "../../src/screens/personal-food-editor";
import { SkeletonBlock, SkeletonGroup } from "../../src/ui/skeleton";
import { useToast } from "../../src/ui/toast";

export { ErrorBoundary } from "./nutrition-library";

export default function PersonalFoodNewRoute() {
	const { classification, barcode } = useLocalSearchParams<{
		classification?: string;
		barcode?: string;
	}>();
	const { t } = useI18n();
	const toast = useToast();
	const openFoodFacts = useOpenFoodFacts();
	const [seed, setSeed] = useState<PersonalFoodDraft | null | undefined>(
		barcode ? undefined : null,
	);
	useEffect(() => {
		if (!barcode) return;
		let live = true;
		void openFoodFacts.lookupBarcode(barcode).then(
			(outcome) => {
				if (!live) return;
				if (outcome.kind === "found") setSeed(outcome.draft);
				else {
					toast.error(t.nutrition.foodImport.notFound);
					setSeed(null);
				}
			},
			() => {
				if (live) setSeed(null);
			},
		);
		return () => {
			live = false;
		};
	}, [barcode, openFoodFacts, t, toast]);
	if (seed === undefined)
		return (
			<SkeletonGroup label={t.nutrition.barcode.lookingUp}>
				<SkeletonBlock height={320} />
			</SkeletonGroup>
		);
	return (
		<PersonalFoodEditor
			defaultClassification={
				classification === "recipe" ? "recipe" : "ordinary"
			}
			seed={seed ?? undefined}
			reviewNotice={
				seed
					? {
							title: t.nutrition.foodImport.reviewTitle,
							attribution: seed.provenance.attribution,
						}
					: undefined
			}
			onCancel={() => router.back()}
			onSaved={() => router.back()}
		/>
	);
}
