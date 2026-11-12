// Section bodies are keyed records (not arrays) so message-parity checks can
// compare every entry between locales.
export const support = {
	title: "Support",
	back: "Back to home",
	intro:
		"Questions, bugs or feedback about Foundry? Email privacy@appelent.nl and we usually reply within two working days.",
	contactLabel: "Email support",
	faq: {
		title: "Common questions",
		items: {
			signIn: {
				q: "How do I sign in?",
				a: "Use email and password, an email code, Apple or Microsoft. The same account works in the app and on the web.",
			},
			oneRm: {
				q: "How does Foundry estimate my 1RM?",
				a: "Each logged set gives an estimated one-rep max. Enter a tested 1RM to plan sets as a percentage of it.",
			},
			food: {
				q: "Where does the food data come from?",
				a: "From the Dutch NEVO food table, Open Food Facts and foods you add yourself. AI help suggests entries you review before saving.",
			},
			export: {
				q: "How do I export or delete my data?",
				a: "In the app, open Profile > Account. You can export all your data or delete your account there.",
			},
		},
	},
	privacyLink: "Privacy statement",
};
