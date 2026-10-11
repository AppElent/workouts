export const localDatabaseCopy = {
	en: {
		title: "SQLite browser",
		intro:
			"Read-only view of this installation’s local databases. Rows may be cached copies, preferences or migration records; their presence does not mean they still need uploading.",
		unavailable: "SQLite inspection is available in development builds only.",
		empty: "No local databases were found.",
		emptyTable: "This table has no rows.",
		back: "All databases",
		tables: "All tables",
		refresh: "Refresh local data",
		previous: "Previous page",
		next: "Next page",
		rows: (count: number) => `${count} ${count === 1 ? "row" : "rows"}`,
		page: (page: number, count: number) =>
			`Page ${page} of ${Math.max(1, Math.ceil(count / 25))}`,
	},
	nl: {
		title: "SQLite-browser",
		intro:
			"Alleen-lezenweergave van de lokale databases van deze installatie. Rijen kunnen kopieën, voorkeuren of migratiegegevens zijn; hun aanwezigheid betekent niet dat ze nog geüpload moeten worden.",
		unavailable: "SQLite-inzage is alleen beschikbaar in ontwikkelbuilds.",
		empty: "Er zijn geen lokale databases gevonden.",
		emptyTable: "Deze tabel heeft geen rijen.",
		back: "Alle databases",
		tables: "Alle tabellen",
		refresh: "Lokale gegevens vernieuwen",
		previous: "Vorige pagina",
		next: "Volgende pagina",
		rows: (count: number) => `${count} ${count === 1 ? "rij" : "rijen"}`,
		page: (page: number, count: number) =>
			`Pagina ${page} van ${Math.max(1, Math.ceil(count / 25))}`,
	},
};
