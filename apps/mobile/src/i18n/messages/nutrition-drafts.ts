/** Capture Drafts: notes filed under a meal that are not intake yet. */
export const nutritionDraftsEn = {
	onDevice: "Note · saved to your account",
	/** Tap = the fast path: reopen the search with the note as the query. */
	resolve: "Resolve note: {note}",
	deleteTitle: "Delete this note?",
	deleteBody: "It has not been logged as food.",
	deleteConfirm: "Delete note",
	deleteFailure: "This note could not be deleted.",
	saveAsNote: "Save as note",
	editTitle: "Edit note",
	noteLabel: "Note",
	mealLabel: "Meal",
	save: "Save note",
	saveFailure: "This note could not be saved. Your text is still here.",
	cancel: "Cancel",
	count: { one: "1 note", other: "{count} notes" },
};

export const nutritionDraftsNl: typeof nutritionDraftsEn = {
	onDevice: "Notitie · opgeslagen in je account",
	resolve: "Notitie verwerken: {note}",
	deleteTitle: "Deze notitie verwijderen?",
	deleteBody: "Deze is nog niet als voeding gelogd.",
	deleteConfirm: "Notitie verwijderen",
	deleteFailure: "Deze notitie kon niet worden verwijderd.",
	saveAsNote: "Opslaan als notitie",
	editTitle: "Notitie bewerken",
	noteLabel: "Notitie",
	mealLabel: "Maaltijd",
	save: "Notitie opslaan",
	saveFailure:
		"Deze notitie kon niet worden opgeslagen. Je tekst staat er nog.",
	cancel: "Annuleren",
	count: { one: "1 notitie", other: "{count} notities" },
};
