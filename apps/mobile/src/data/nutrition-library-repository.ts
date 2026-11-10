import { registerLocalDatabase } from "../local-store/local-store";

type LibraryRecordKind = "food" | "combo";
export type LibraryRecord = {
	readonly subject?: string;
	readonly id: string;
	readonly kind: LibraryRecordKind;
	readonly payload: string | null;
	readonly revision: number;
	readonly deleted: boolean;
};

/** A safe, deterministic filename; account identifiers never become SQL or paths. */
export function nutritionLibraryDatabaseName(subject: string) {
	const encoded = Array.from(new TextEncoder().encode(subject), (byte) =>
		byte.toString(16).padStart(2, "0"),
	).join("");
	return `workouts-nutrition-library-${encoded.slice(0, 160)}.db`;
}
registerLocalDatabase(/^workouts-nutrition-library-[0-9a-f]+\.db$/);
