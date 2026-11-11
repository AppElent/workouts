import type {
	Combo,
	LibraryCategory,
	LibraryRecordKind,
	PersonalFood,
} from "@foundry/core";

type IndexFields = {
	name: string;
	searchText: string;
	category: LibraryCategory;
	barcode?: string;
	forkedFrom?: string;
};

/**
 * Derived fields only; validated payloads remain the portable record contract.
 * `payload` is a record the library already accepted; tombstones have none.
 */
export function libraryIndexFields(
	kind: LibraryRecordKind,
	payload?: string,
): IndexFields {
	if (!payload) return { name: "", searchText: "", category: kind };
	if (kind === "combo") {
		const combo: Combo = JSON.parse(payload);
		const parts = combo.parts
			.map(({ snapshot }) => `${snapshot.name.en} ${snapshot.name.nl}`)
			.join(" ");
		return {
			name: combo.name.toLocaleLowerCase(),
			searchText: `${combo.name} ${parts}  `,
			category: kind,
		};
	}
	const food: PersonalFood = JSON.parse(payload);
	const name = `${food.name.en} ${food.name.nl}`;
	const { brand, barcode, forkedFrom } = food.provenance;
	return {
		name: name.toLocaleLowerCase(),
		searchText: `${name}  ${brand ?? ""} ${barcode ?? ""}`,
		category: food.classification === "recipe" ? "recipe" : kind,
		barcode,
		forkedFrom,
	};
}
