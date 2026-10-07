/** Derived fields only; validated payloads remain the portable record contract. */
export function libraryIndexFields(kind: "food" | "combo", payload?: string) {
 if (!payload) return { name: "", searchText: "", category: kind === "combo" ? "combo" as const : "food" as const };
 const record = JSON.parse(payload);
 const name = kind === "combo" ? record.name : `${record.name.en} ${record.name.nl}`;
 const parts = kind === "combo" ? record.parts.map((part: { snapshot: { name: { en: string; nl: string } } }) => `${part.snapshot.name.en} ${part.snapshot.name.nl}`).join(" ") : "";
 return {
  name: name.toLocaleLowerCase(),
  searchText: `${name} ${parts} ${record.provenance?.brand ?? ""} ${record.provenance?.barcode ?? ""}`,
  category: kind === "combo" ? "combo" as const : record.classification === "recipe" ? "recipe" as const : "food" as const,
  barcode: record.provenance?.barcode as string | undefined,
  forkedFrom: record.provenance?.forkedFrom as string | undefined,
 };
}
