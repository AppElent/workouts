import type { ClerkErrorMessageKey } from "@foundry/core";

export const authErrorsEn: Record<ClerkErrorMessageKey, string> = {
	generic: "Something went wrong. Please try again.",
	identifierNotFound: "No account found with that email.",
	passwordIncorrect: "That password is not right.",
	identifierExists: "An account with that email already exists.",
	emailInvalid: "Enter a valid email address.",
	required: "This field is required.",
	passwordTooShort: "That password is too short.",
	passwordPwned: "That password has appeared in a data breach. Choose another.",
	passwordDoesNotMeetRequirements: "That password is not strong enough.",
	codeIncorrect: "That code is not right.",
	codeExpired: "That code has expired. Send a new one.",
	tooManyRequests: "Too many attempts. Try again in a moment.",
	network: "Network error. Check your connection and try again.",
	appleSignInIncomplete:
		"Apple sign-in didn't finish. Check that you're signed in to your Apple Account in Settings.",
};

export const authErrorsNl: typeof authErrorsEn = {
	generic: "Er ging iets mis. Probeer het opnieuw.",
	identifierNotFound: "Geen account gevonden met dat e-mailadres.",
	passwordIncorrect: "Dat wachtwoord klopt niet.",
	identifierExists: "Er bestaat al een account met dat e-mailadres.",
	emailInvalid: "Vul een geldig e-mailadres in.",
	required: "Dit veld is verplicht.",
	passwordTooShort: "Dat wachtwoord is te kort.",
	passwordPwned:
		"Dat wachtwoord is uitgelekt bij een datalek. Kies een ander wachtwoord.",
	passwordDoesNotMeetRequirements: "Dat wachtwoord is niet sterk genoeg.",
	codeIncorrect: "Die code klopt niet.",
	codeExpired: "Die code is verlopen. Vraag een nieuwe aan.",
	tooManyRequests: "Te veel pogingen. Probeer het zo opnieuw.",
	network: "Netwerkfout. Controleer je verbinding en probeer het opnieuw.",
	appleSignInIncomplete:
		"Inloggen met Apple is niet afgerond. Controleer of je bij Instellingen bent ingelogd met je Apple-account.",
};
