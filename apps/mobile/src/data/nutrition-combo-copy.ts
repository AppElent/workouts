export function nutritionComboCopy(locale: "en" | "nl") {
	return locale === "nl"
		? {
				comboScale: "Deze Combo schalen",
				comboScaleHelp:
					"Dit verandert alleen deze registratie; de opgeslagen Combo blijft gelijk.",
				comboScaleInvalid: "Vul een positief getal in.",
			}
		: {
				comboScale: "Scale this Combo",
				comboScaleHelp:
					"Changes this log only; the saved Combo stays unchanged.",
				comboScaleInvalid: "Enter a positive number.",
			};
}
