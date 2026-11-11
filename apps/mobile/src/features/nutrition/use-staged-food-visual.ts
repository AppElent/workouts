import type { FoodVisual } from "@foundry/core";
import { useEffect, useRef, useState } from "react";
import {
	type FoodPhotoSource,
	foodPhotos,
} from "../../data/food-photo-manager";

/** A food's visual while editing: a saved one, or an imported photo not yet copied. */
export type EditorVisual =
	| FoodVisual
	| { readonly kind: "remote"; readonly uri: string };

/**
 * The visual a food form is building. A photo taken or chosen here is
 * staged: it is removed again when it is replaced, discarded, or left behind
 * unsaved, so cancelling never leaves a stray file.
 */
export function useStagedFoodVisual({
	initial,
	adoptInitialPhoto = false,
	messages,
	onChange,
}: {
	initial?: EditorVisual;
	/** The initial photo is unsaved, so cancelling removes it like a new one. */
	adoptInitialPhoto?: boolean;
	messages: { permissionDenied: string; failure: string };
	/** After every change by the person, such as marking a draft dirty. */
	onChange?: () => void;
}) {
	const [visual, setVisual] = useState<EditorVisual | undefined>(initial);
	const [error, setError] = useState<string>();
	const [busy, setBusy] = useState(false);
	const staged = useRef<string | undefined>(
		adoptInitialPhoto && initial?.kind === "photo" ? initial.uri : undefined,
	);
	const kept = useRef(false);

	useEffect(
		() => () => {
			if (!kept.current && staged.current)
				foodPhotos.remove({ kind: "photo", uri: staged.current });
		},
		[],
	);

	function replace(next: EditorVisual | undefined) {
		if (
			staged.current &&
			(next?.kind !== "photo" || next.uri !== staged.current)
		) {
			foodPhotos.remove({ kind: "photo", uri: staged.current });
			staged.current = undefined;
		}
		setVisual(next);
		setError(undefined);
		onChange?.();
	}

	async function choose(from: FoodPhotoSource) {
		if (busy) return;
		setBusy(true);
		setError(undefined);
		try {
			const choice = await foodPhotos.choose(from);
			if (choice.kind === "denied") setError(messages.permissionDenied);
			else if (choice.kind === "selected") {
				replace(choice.visual);
				staged.current = choice.visual.uri;
			}
		} catch {
			setError(messages.failure);
		} finally {
			setBusy(false);
		}
	}

	return {
		visual,
		error,
		busy,
		replace,
		choose,
		/** The staged photo now belongs to what was saved or logged. */
		keep: () => {
			kept.current = true;
		},
		/** Drop a staged photo now, such as when the form is discarded. */
		discard: () => {
			if (staged.current) {
				foodPhotos.remove({ kind: "photo", uri: staged.current });
				staged.current = undefined;
			}
		},
	};
}
