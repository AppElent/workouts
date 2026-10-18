import type { privacy as enPrivacy } from "../en/privacy";

export const privacy = {
	title: "Privacyverklaring",
	updated: "Laatst bijgewerkt: 18 oktober 2026",
	back: "Terug naar home",
	intro: {
		title: "Wie we zijn",
		body: {
			who: "Foundry is een app voor training en voeding, beschikbaar als mobiele app en als webapp op foundry.appelent.nl. Foundry wordt ontwikkeld door Appelent. Appelent is verantwoordelijk voor de verwerking van je persoonsgegevens zoals beschreven in deze verklaring.",
			contact:
				"Voor vragen over deze verklaring of je gegevens kun je mailen naar privacy@appelent.nl.",
		},
	},
	collect: {
		title: "Welke gegevens we verzamelen",
		items: {
			account: "Accountgegevens: je naam, e-mailadres en inloggegevens.",
			training:
				"Trainingsgegevens: trainingen, sets, routines, WOD's, duuractiviteiten en persoonlijke records die je vastlegt.",
			health:
				"Voedings- en lichaamsgegevens: je voedingsdagboek, voedingsmiddelen, combinaties, voedingsdoelen, lichaamsmetingen zoals gewicht en persoonlijke metingen. Dit kunnen gezondheidsgegevens zijn; we verwerken ze alleen omdat jij ervoor kiest ze vast te leggen.",
			photos:
				"Foto's die je toevoegt aan voedingsmiddelen of dagboekregels, en je profielfoto.",
			ai: "Invoerhulp met AI: in de mobiele app de maaltijdtekst en foto's die je naar de invoerhulp met AI stuurt, nadat je daarmee akkoord bent gegaan.",
			shared:
				"Gedeelde trainingen: als je een gedeelde training organiseert of eraan meedoet, zijn je weergavenaam en ingediende resultaten zichtbaar voor de organisator en andere deelnemers. Gasten geven een naam op bij hun resultaat.",
			diagnostics:
				"Diagnostische gegevens: crashrapporten, prestatiemetingen en, in de mobiele app, een kleine steekproef van sessie-opnames waarin alle tekst en afbeeldingen zijn afgeschermd. Deze zijn alleen gekoppeld aan een anoniem account-ID; e-mailadressen, inloggegevens en trainings- of voedingswaarden worden eruit gefilterd.",
			feedback:
				"Probleemmeldingen: het bericht en een eventuele schermafbeelding die je meestuurt via Probleem melden.",
			device:
				"Op je toestel: voorkeuren, recente keuzes en caches. Deze blijven op het toestel.",
		},
	},
	purposes: {
		title: "Waarom we ze gebruiken",
		body: {
			service:
				"We gebruiken je gegevens om Foundry te leveren: om je account bij te houden, wat je vastlegt op te slaan en tussen toestellen te synchroniseren, en je voortgang te tonen. Dit is nodig om onze overeenkomst met jou uit te voeren.",
			health:
				"We verwerken voedings- en lichaamsgegevens op basis van je uitdrukkelijke toestemming, die je geeft door ze in te voeren. Je kunt je toestemming altijd intrekken door die gegevens te verwijderen.",
			diagnostics:
				"We gebruiken diagnostische gegevens en probleemmeldingen om fouten te vinden en op te lossen, op basis van ons gerechtvaardigd belang bij een betrouwbare app.",
			noAds:
				"We verkopen je gegevens niet, tonen geen advertenties en gebruiken je gegevens niet voor marketing of profilering.",
		},
	},
	providers: {
		title: "Dienstverleners",
		intro:
			"We gebruiken de volgende dienstverleners om Foundry te laten werken. Zij verwerken gegevens alleen in onze opdracht.",
		items: {
			clerk: "Clerk: inloggen en accountbeheer.",
			convex:
				"Convex: database en bestandsopslag, gehost in de Europese Unie (Ierland).",
			cloudflare: "Cloudflare: hosting van de webapp.",
			sentry: "Sentry: foutmonitoring en probleemmeldingen.",
			expo: "Expo: levering van updates voor de mobiele app.",
			anthropic:
				"Anthropic: invoerhulp met AI in de mobiele app. Je tekst en foto's worden alleen na je toestemming verstuurd, om voedingsmiddelen te herkennen. Ze worden niet in je account opgeslagen en niet gebruikt om modellen te trainen.",
		},
		signIn:
			"Als je inlogt met Apple of Microsoft, bevestigt dat bedrijf je identiteit en deelt het je naam en e-mailadres met ons. Voor dat inloggen geldt hun eigen privacybeleid.",
		openFoodFacts:
			"Als je een barcode scant of een voedingsmiddel zoekt, wordt de barcode of zoektekst naar Open Food Facts gestuurd om productinformatie op te halen. Dit verzoek is niet gekoppeld aan je account.",
		transfers:
			"Sommige dienstverleners kunnen gegevens buiten de Europese Economische Ruimte verwerken. In dat geval gebeurt de doorgifte met passende waarborgen, zoals het EU-VS-gegevensprivacykader of de standaardcontractbepalingen van de Europese Commissie.",
	},
	retention: {
		title: "Hoe lang we ze bewaren",
		body: {
			account:
				"We bewaren je gegevens zolang je een account hebt. Als je je account in de mobiele app verwijdert, worden je gegevens en account direct verwijderd. Vraag je het ons per e-mail, dan verwijderen we ze binnen 30 dagen.",
			diagnostics:
				"Diagnostische gegevens en probleemmeldingen worden na maximaal 90 dagen automatisch verwijderd.",
		},
	},
	rights: {
		title: "Je rechten",
		body: {
			rights:
				"Je hebt het recht je gegevens in te zien, te corrigeren, te verwijderen of te exporteren, de verwerking te beperken of er bezwaar tegen te maken, en je toestemming in te trekken.",
			howTo:
				"In de mobiele app kun je via het Account-scherm je gegevens exporteren, je gegevens verwijderen of je account verwijderen. Je kunt je gegevens ook exporteren via de Account-pagina in de webapp. Wil je je account per e-mail laten verwijderen, of heb je een ander verzoek, mail dan naar privacy@appelent.nl. We reageren binnen een maand.",
			complaint:
				"Ben je niet tevreden over hoe we met je gegevens omgaan, dan kun je een klacht indienen bij de Autoriteit Persoonsgegevens of bij de toezichthouder in je eigen land.",
		},
	},
	security: {
		title: "Beveiliging",
		body: "Gegevens worden via versleutelde verbindingen verstuurd en elk account heeft alleen toegang tot zijn eigen gegevens. Toegang is beveiligd met inloggen.",
	},
	children: {
		title: "Kinderen",
		body: "Foundry is niet bedoeld voor kinderen jonger dan 16 jaar.",
	},
	changes: {
		title: "Wijzigingen",
		body: "We kunnen deze verklaring aanpassen. De datum bovenaan toont de nieuwste versie.",
	},
} satisfies typeof enPrivacy;
