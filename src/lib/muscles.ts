import { type Muscle, muscleKey } from "@foundry/core";

/** The muscle's name in the current language; unknown names stay as stored. */
export function muscleLabel(name: string, labels: Record<Muscle, string>) {
	const key = muscleKey(name);
	return key ? labels[key] : name.trim();
}
