import type { auth as enAuth } from "../en/auth";

export const auth = {
	wait: "Even geduld…",
	or: "of",
	email: "E-mail",
	password: "Wachtwoord",
	continueWith: "Doorgaan met {provider}",
	signIn: {
		title: "Inloggen",
		subtitle: "Welkom terug bij Foundry.",
		submit: "Inloggen",
		forgotPassword: "Wachtwoord vergeten?",
		createAccount: "Account aanmaken",
		needsVerification: "Er is extra verificatie nodig.",
	},
	signUp: {
		title: "Maak je account aan",
		submit: "Account aanmaken",
		haveAccount: "Heb je al een account? Inloggen",
		codeSent: "We hebben een code gestuurd naar {email}.",
		code: "Verificatiecode",
		verify: "Verifiëren",
		invalidCode: "Ongeldige of onvolledige verificatie.",
	},
	forgotPassword: {
		title: "Wachtwoord opnieuw instellen",
		sendCode: "Code versturen",
		code: "Code",
		newPassword: "Nieuw wachtwoord",
		submit: "Wachtwoord opnieuw instellen",
		failed: "Kon het wachtwoord niet opnieuw instellen.",
	},
	ssoCallback: {
		title: "Je wordt ingelogd…",
	},
	testLogin: {
		button: "▶ Dev: inloggen als testgebruiker",
		needsSteps: "De testgebruiker heeft extra stappen nodig.",
	},
} satisfies typeof enAuth;
