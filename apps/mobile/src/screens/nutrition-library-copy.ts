export const nutritionLibraryCopy = {
	en: {
		eyebrow: "PERSONAL LIBRARY",
		title: "Back up and restore your foods and Combos",
		intro:
			"Diary history is saved as independent snapshots. Background sync uploads local library changes; opening this screen explicitly restores the latest reusable Personal Foods and fixed Combos.",
		disabled:
			"Backup is off. Existing device foods remain private to this device until you explicitly import them.",
		enable: "Enable backup for this account",
		import: "Import this device library",
		importHelp:
			"Copy the current device library into this signed-in account once. IDs and Combo references are retained.",
		restore: "Restore latest library",
		retryUpload: "Retry upload",
		pending: "Changes waiting to sync",
		conflicts: "Needs your decision",
		keep: "Keep this device copy",
		server: "Use server copy",
		unnamedFood: "Unnamed Personal Food",
		unnamedCombo: "Unnamed Combo",
		confirmEnableTitle: "Enable library backup?",
		confirmEnableBody:
			"A new, empty library will be associated with this account. Device foods are not imported automatically.",
		confirmEnable: "Enable backup",
		confirmImportTitle: "Import this device library?",
		confirmImportBody:
			"This copies its Personal Foods and Combos into this account with the same IDs. Diary history is not changed.",
		confirmImport: "Import device library",
		confirmServerTitle: "Use the server copy?",
		confirmServerBody: (name: string) =>
			`Use the server version of ${name}? This discards every pending local change for this item.`,
		confirmServer: "Discard local changes",
		ready: "Backup is enabled for this account.",
		imported: "Device library queued for backup.",
		failure:
			"The library action could not be completed. Some changes may already be saved locally. Retry or reopen to recover.",
		loading: "Loading backed-up library",
		offline:
			"Backup data is unavailable while offline. Local changes remain queued on this device.",
	},
	nl: {
		eyebrow: "PERSOONLIJKE BIBLIOTHEEK",
		title:
			"Maak een reservekopie van je voedingsmiddelen en Combo's en herstel ze",
		intro:
			"Dagboekgeschiedenis wordt als onafhankelijke snapshots opgeslagen. Achtergrondsynchronisatie uploadt lokale bibliotheekwijzigingen; door dit scherm te openen herstel je expliciet de nieuwste herbruikbare Persoonlijke Voedingsmiddelen en vaste Combo's.",
		disabled:
			"Reservekopie staat uit. Bestaande voedingsmiddelen blijven op dit apparaat totdat je ze expliciet importeert.",
		enable: "Reservekopie voor dit account inschakelen",
		import: "Deze apparaatbibliotheek importeren",
		importHelp:
			"Kopieer de huidige apparaatbibliotheek eenmalig naar dit ingelogde account. ID's en Combo-verwijzingen blijven behouden.",
		restore: "Nieuwste bibliotheek herstellen",
		retryUpload: "Upload opnieuw proberen",
		pending: "Wijzigingen wachten op synchronisatie",
		conflicts: "Jouw keuze is nodig",
		keep: "Deze apparaatkopie behouden",
		server: "Serverkopie gebruiken",
		unnamedFood: "Naamloos Persoonlijk Voedingsmiddel",
		unnamedCombo: "Naamloze Combo",
		confirmEnableTitle: "Bibliotheekreservekopie inschakelen?",
		confirmEnableBody:
			"Een nieuwe, lege bibliotheek wordt aan dit account gekoppeld. Apparaatvoedingsmiddelen worden niet automatisch geïmporteerd.",
		confirmEnable: "Reservekopie inschakelen",
		confirmImportTitle: "Deze apparaatbibliotheek importeren?",
		confirmImportBody:
			"Dit kopieert Persoonlijke Voedingsmiddelen en Combo's met dezelfde ID's naar dit account. Dagboekgeschiedenis verandert niet.",
		confirmImport: "Apparaatbibliotheek importeren",
		confirmServerTitle: "Serverkopie gebruiken?",
		confirmServerBody: (name: string) =>
			`De serverversie van ${name} gebruiken? Hiermee worden alle lokale wijzigingen die nog wachten voor dit item verwijderd.`,
		confirmServer: "Lokale wijzigingen verwijderen",
		ready: "Reservekopie is ingeschakeld voor dit account.",
		imported: "Apparaatbibliotheek staat klaar voor reservekopie.",
		failure:
			"De bibliotheekactie kon niet worden voltooid. Sommige wijzigingen kunnen al lokaal zijn opgeslagen. Probeer opnieuw of open dit scherm opnieuw om te herstellen.",
		loading: "Bibliotheekreservekopie laden",
		offline:
			"Reservekopiegegevens zijn offline niet beschikbaar. Lokale wijzigingen blijven op dit apparaat in de wachtrij staan.",
	},
} as const;
