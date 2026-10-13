export const localDataEn = {
	maintenance: {
		title: "Account cache",
		pending: "Clearing cached account data…",
		cleanupError:
			"Cleanup could not finish. Pending data is preserved. Retry to finish safely.",
		retryCleanup: "Retry cleanup",
		back: "Back to the app",
		success: "Account cache cleared.",
		error: "Local data could not be cleaned.",
		offline: "Connect to clear cached account data.",
	},
	database: {
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
		rows: { one: "{count} row", other: "{count} rows" },
		page: "Page {page} of {pages}",
	},
	settings: {
		title: "Photos and cache",
		body: "Your saved data belongs to your account. Your own photos use Convex storage; Open Food Facts photos load from their source and are cached on this device.",
		pendingPhotos: {
			one: "1 device photo still needs uploading.",
			other: "{count} device photos still need uploading.",
		},
		uploadPhotos: "Upload device photos",
		clearCache: "Clear cached account data",
		clearCacheNote:
			"Preferences, last-used portions and unfinished Set Drafts remain. Account data reloads from Convex.",
	},
};

export const localDataNl: typeof localDataEn = {
	maintenance: {
		title: "Lokale gegevens opruimen",
		pending: "Accountcache wissen…",
		cleanupError:
			"Het opruimen is niet voltooid. Wachtende gegevens blijven bewaard. Probeer opnieuw om veilig af te ronden.",
		retryCleanup: "Opruimen opnieuw proberen",
		back: "Terug naar de app",
		success: "Accountcache gewist.",
		error: "Lokale gegevens konden niet worden opgeruimd.",
		offline: "Maak verbinding om accountcache te wissen.",
	},
	database: {
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
		rows: { one: "{count} rij", other: "{count} rijen" },
		page: "Pagina {page} van {pages}",
	},
	settings: {
		title: "Foto’s en cache",
		body: "Je opgeslagen gegevens staan in je account. Eigen foto’s staan in Convex; Open Food Facts-foto’s worden vanaf de bron geladen en op dit apparaat gecachet.",
		pendingPhotos: {
			one: "1 apparaatfoto moet nog worden geüpload.",
			other: "{count} apparaatfoto’s moeten nog worden geüpload.",
		},
		uploadPhotos: "Apparaatfoto’s uploaden",
		clearCache: "Accountcache wissen",
		clearCacheNote:
			"Voorkeuren, laatst gebruikte porties en onafgemaakte Setconcepten blijven bewaard. Accountgegevens worden opnieuw geladen.",
	},
};
