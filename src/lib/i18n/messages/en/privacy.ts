// Section bodies are keyed records (not arrays) so message-parity checks can
// compare every paragraph and list item between locales.
export const privacy = {
	title: "Privacy statement",
	updated: "Last updated: 18 October 2026",
	back: "Back to home",
	intro: {
		title: "Who we are",
		body: {
			who: "Foundry is a workout and nutrition tracker, available as a mobile app and as a web app at foundry.appelent.nl. Foundry is developed by Appelent, which is responsible for processing your personal data as described in this statement.",
			contact:
				"For questions about this statement or your data, email privacy@appelent.nl.",
		},
	},
	collect: {
		title: "What we collect",
		items: {
			account:
				"Account details: your name, email address, and sign-in information.",
			training:
				"Training data: workouts, sets, routines, WODs, endurance activities, and personal records you log.",
			health:
				"Nutrition and body data: your food diary, foods, combos, nutrition goals, body metrics such as weight, and personal measures. This can be health data; we only process it because you choose to log it.",
			photos:
				"Photos you add to foods or diary entries, and your profile photo.",
			ai: "AI entry help: in the mobile app, the meal text and photos you send to AI entry help, after you agree to it.",
			shared:
				"Shared workouts: when you host or join a shared workout, your display name and submitted results are visible to the host and other participants. Guests provide a name with their result.",
			diagnostics:
				"Diagnostics: crash reports, performance measurements, and, in the mobile app, a small sample of session replays with all text and images masked. These are linked only to an anonymous account ID; email addresses, credentials, and workout or nutrition values are filtered out.",
			feedback:
				"Problem reports: the message and any screenshot you choose to send with Report a problem.",
			device:
				"On your device: preferences, recent choices, and caches. These stay on the device.",
		},
	},
	purposes: {
		title: "Why we use it",
		body: {
			service:
				"We use your data to provide Foundry: to keep your account, store and sync what you log across devices, and show your progress. This is necessary to perform our agreement with you.",
			health:
				"We process nutrition and body data based on your explicit consent, given by entering it. You can withdraw consent at any time by deleting that data.",
			diagnostics:
				"We use diagnostics and problem reports to find and fix errors, based on our legitimate interest in a reliable app.",
			noAds:
				"We do not sell your data, show advertising, or use your data for marketing or profiling.",
		},
	},
	providers: {
		title: "Service providers",
		intro:
			"We use the following providers to run Foundry. They process data only on our behalf.",
		items: {
			clerk: "Clerk: sign-in and account management.",
			convex:
				"Convex: database and file storage, hosted in the European Union (Ireland).",
			cloudflare: "Cloudflare: hosting of the web app.",
			sentry: "Sentry: error monitoring and problem reports.",
			expo: "Expo: delivery of mobile app updates.",
			anthropic:
				"Anthropic: AI entry help in the mobile app. Your text and photos are sent only after you agree, to recognise foods. They are not stored in your account and not used to train models.",
		},
		signIn:
			"If you sign in with Apple or Microsoft, that company confirms your identity and shares your name and email address with us. Their own privacy policies apply to that sign-in.",
		openFoodFacts:
			"When you scan a barcode or search for a food, the barcode or search text is sent to Open Food Facts to look up product information. This request is not linked to your account.",
		transfers:
			"Some providers may process data outside the European Economic Area. In that case, transfers rely on appropriate safeguards, such as the EU–US Data Privacy Framework or the European Commission's Standard Contractual Clauses.",
	},
	retention: {
		title: "How long we keep it",
		body: {
			account:
				"We keep your data for as long as you have an account. When you delete your account in the mobile app, your data and account are deleted right away. If you ask us by email instead, we delete them within 30 days.",
			diagnostics:
				"Diagnostics and problem reports are deleted automatically after at most 90 days.",
		},
	},
	rights: {
		title: "Your rights",
		body: {
			rights:
				"You have the right to access, correct, delete, or export your data, to restrict or object to its processing, and to withdraw consent.",
			howTo:
				"You can export your data, delete your data, or delete your account from the Account screen in the mobile app. You can also export your data from the Account page in the web app. To delete your account by email, or for any other request, email privacy@appelent.nl. We respond within one month.",
			complaint:
				"If you are not satisfied with how we handle your data, you can file a complaint with the Dutch Data Protection Authority (Autoriteit Persoonsgegevens) or the data protection authority in your country.",
		},
	},
	security: {
		title: "Security",
		body: "Data is sent over encrypted connections, and each account can only access its own data. Access is protected by sign-in.",
	},
	children: {
		title: "Children",
		body: "Foundry is not intended for children under 16.",
	},
	changes: {
		title: "Changes",
		body: "We may update this statement. The date at the top shows the latest version.",
	},
};
