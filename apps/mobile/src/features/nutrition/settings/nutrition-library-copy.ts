export const nutritionLibraryCopy = {
	en: {
		eyebrow: "PERSONAL LIBRARY",
		title: "Library settings",
		intro:
			"Personal Foods and Combos are saved to your account. Saving requires a connection. Meals already logged keep their original nutrition values.",
		photoNotice:
			"Food photos stay on this device. On another device, Foods keep preset icons and use the default visual where a photo is unavailable.",
		offTitle: "Open Food Facts",
		offHelp:
			"Refresh imported products from their barcodes. Your edited names, nutrition values, custom portions, and chosen Food Visual stay unchanged.",
		offRefresh: "Refresh imported foods",
		offPhotoFailure:
			"Nutrition was refreshed, but one product photo could not be saved. It will be retried next time.",
		offRefreshing: "Refreshing imported foods…",
		offEmpty:
			"Products you import from Open Food Facts can be refreshed here. None are saved yet.",
		offConfirmTitle: "Refresh imported foods?",
		offConfirmBody: (count: number) =>
			`Foundry will check ${count} saved ${count === 1 ? "food" : "foods"}. Open Food Facts limits product lookups, so this can take about ${Math.max(1, Math.ceil(count / 15))} minute${count > 15 ? "s" : ""}.`,
		offConfirm: "Refresh foods",
		offProgress: (completed: number, total: number) =>
			`${completed} of ${total} checked`,
		offSummary: (updated: number, unchanged: number, failed: number) =>
			`${updated} updated · ${unchanged} unchanged · ${failed} not refreshed`,
		failure:
			"The action could not be saved. Your input is still available while this editor stays open.",
		offline: "A connection is required to save.",
	},
	nl: {
		eyebrow: "PERSOONLIJKE BIBLIOTHEEK",
		title: "Bibliotheekinstellingen",
		intro:
			"Persoonlijke Voedingsmiddelen en Combo's worden in je account opgeslagen. Opslaan vereist verbinding. Eerder gelogde maaltijden behouden hun oorspronkelijke voedingswaarden.",
		photoNotice:
			"Voedingsfoto's blijven op dit apparaat. Op een ander apparaat behouden voedingsmiddelen gekozen iconen en gebruiken ze de standaardafbeelding waar een foto ontbreekt.",
		offTitle: "Open Food Facts",
		offHelp:
			"Vernieuw geïmporteerde producten via hun barcode. Je aangepaste namen, voedingswaarden, eigen porties en gekozen voedingsvisual blijven ongewijzigd.",
		offRefresh: "Geïmporteerde voeding vernieuwen",
		offPhotoFailure:
			"De voedingswaarden zijn vernieuwd, maar één productfoto kon niet worden opgeslagen. Bij de volgende keer proberen we het opnieuw.",
		offRefreshing: "Geïmporteerde voeding vernieuwen…",
		offEmpty:
			"Er is nog geen Open Food Facts-voeding met barcode in je account opgeslagen.",
		offConfirmTitle: "Geïmporteerde voeding vernieuwen?",
		offConfirmBody: (count: number) =>
			`Foundry controleert ${count} opgeslagen ${count === 1 ? "voedingsmiddel" : "voedingsmiddelen"}. Open Food Facts beperkt productopvragingen, dus dit kan ongeveer ${Math.max(1, Math.ceil(count / 15))} ${count > 15 ? "minuten" : "minuut"} duren.`,
		offConfirm: "Voeding vernieuwen",
		offProgress: (completed: number, total: number) =>
			`${completed} van ${total} gecontroleerd`,
		offSummary: (updated: number, unchanged: number, failed: number) =>
			`${updated} vernieuwd · ${unchanged} ongewijzigd · ${failed} niet vernieuwd`,
		failure:
			"De actie kon niet worden opgeslagen. Je invoer blijft beschikbaar zolang dit formulier open is.",
		offline: "Opslaan vereist verbinding.",
	},
} as const;
