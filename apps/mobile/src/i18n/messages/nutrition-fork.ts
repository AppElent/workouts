/**
 * Correcting a shipped food. A correction never edits the shipped
 * record: it creates the user's own food that stands in front of it. The
 * copy says "your correction", never "the fixed version", because nothing
 * here claims the user is right and NEVO is wrong.
 */
export const nutritionForkEn = {
	correct: "Correct this food",
	intro:
		"This saves your own copy. The bundled food is left as published, and your copy replaces it in ordinary search.",
	forkedFrom: "Your correction of {name}",
	locallyEdited: "You changed this food.",
	unchanged: "You have not changed this food yet.",
	/** Caption on the original, in the deliberate broader view only. */
	shadowed: "Replaced by your correction",
	deleteTitle: "Delete this correction?",
	deleteBody:
		"The bundled food returns to search. Diary entries keep the nutrition they were logged with.",
};

export const nutritionForkNl: typeof nutritionForkEn = {
	correct: "Dit voedingsmiddel corrigeren",
	intro:
		"Dit slaat je eigen kopie op. Het meegeleverde voedingsmiddel blijft zoals het is gepubliceerd en jouw kopie vervangt het in de gewone zoekresultaten.",
	forkedFrom: "Jouw correctie van {name}",
	locallyEdited: "Je hebt dit voedingsmiddel aangepast.",
	unchanged: "Je hebt dit voedingsmiddel nog niet aangepast.",
	shadowed: "Vervangen door jouw correctie",
	deleteTitle: "Deze correctie verwijderen?",
	deleteBody:
		"Het meegeleverde voedingsmiddel komt terug in de zoekresultaten. Dagboekitems behouden de voedingswaarde waarmee ze zijn vastgelegd.",
};
