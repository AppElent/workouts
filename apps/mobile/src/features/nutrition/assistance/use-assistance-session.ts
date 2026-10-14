import { shippedLibrary } from "@foundry/core/nutrition";
import { useMemo, useRef, useState } from "react";
import {
	applyChoices,
	chooseInput,
	groundItems,
	type ImageInput,
	personalFoodDraftFromReading,
	prepareImage,
	type ReviewItem,
} from "../../../data/nutrition-ai";
import { buildAssistanceFoodCatalog } from "../../../data/nutrition-assistance";
import type { PersonalFoodDraft } from "../../../data/personal-food-repository";
import { usePersonalFoods } from "../../../data/personal-foods";
import { useI18n } from "../../../i18n";
import {
	type NutritionAiFailure,
	nutritionAiFailure,
	useNutritionAi,
} from "../use-nutrition-ai";

export type AssistancePhase =
	| { readonly kind: "input"; readonly problem?: "noFood" | NutritionAiFailure }
	| { readonly kind: "analysing" }
	| {
			readonly kind: "review";
			readonly seen: string;
			readonly items: readonly ReviewItem[];
	  }
	| { readonly kind: "label"; readonly draft: PersonalFoodDraft };

/**
 * One Hulp bij invoeren session: the input, the analysis, and the reviewed
 * items. Logging and the follow-up forms belong to the screen.
 */
export function useAssistanceSession(initialText: string) {
	const { locale } = useI18n();
	const ai = useNutritionAi();
	const personalFoods = usePersonalFoods();
	const [text, setText] = useState(initialText);
	const [photo, setPhoto] = useState<string>();
	const [phase, setPhase] = useState<AssistancePhase>({ kind: "input" });
	// A cancelled or superseded analysis must not land.
	const run = useRef(0);
	const catalog = useMemo(
		() =>
			buildAssistanceFoodCatalog(shippedLibrary().active, personalFoods.list()),
		[personalFoods],
	);

	async function analyse() {
		if (!text.trim() && !photo) return;
		if (!ai.online) {
			setPhase({ kind: "input", problem: "offline" });
			return;
		}
		const current = ++run.current;
		const live = () => run.current === current;
		setPhase({ kind: "analysing" });
		try {
			let image: ImageInput | undefined;
			if (photo) image = await prepareImage(photo);
			const described = await ai.describe({
				text: text.trim() || undefined,
				image,
				locale,
			});
			if (!live()) return;
			if (described.kind === "label" && image) {
				const reading = await ai.readLabel({ image, locale });
				if (!live()) return;
				setPhase(
					reading.isLabel
						? { kind: "label", draft: personalFoodDraftFromReading(reading) }
						: { kind: "input", problem: "noFood" },
				);
				return;
			}
			if (described.kind !== "meal") {
				setPhase({ kind: "input", problem: "noFood" });
				return;
			}
			const grounded = groundItems(described.items, catalog, locale);
			const choices = await ai.choose({
				items: chooseInput(
					grounded,
					described.items.map((item) => item.brand),
				),
			});
			if (!live()) return;
			setPhase({
				kind: "review",
				seen: described.seen,
				items: applyChoices(grounded, choices),
			});
		} catch (error) {
			if (live())
				setPhase({ kind: "input", problem: nutritionAiFailure(error) });
		}
	}

	return {
		ai,
		text,
		setText,
		photo,
		setPhoto,
		phase,
		analyse,
		cancel: () => {
			run.current += 1;
			setPhase({ kind: "input" });
		},
		/** "Wijzig": back to the input with everything still in it. */
		edit: () => setPhase({ kind: "input" }),
		setItems: (items: readonly ReviewItem[]) =>
			setPhase((current) =>
				current.kind === "review" ? { ...current, items } : current,
			),
		showItems: (seen: string, items: readonly ReviewItem[]) =>
			setPhase({ kind: "review", seen, items }),
	};
}
