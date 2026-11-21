import type { auth as enAuth } from "../en/auth";

export const auth = {
	wait: "Even geduld…",
	or: "of",
	email: "E-mail",
	password: "Wachtwoord",
	continueWith: "Doorgaan met {provider}",
	errors: {
		generic: "Er ging iets mis. Probeer het opnieuw.",
		identifierNotFound: "Er is geen account met dit e-mailadres.",
		passwordIncorrect: "Dit wachtwoord klopt niet.",
		identifierExists: "Er bestaat al een account met dit e-mailadres.",
		emailInvalid: "Voer een geldig e-mailadres in.",
		required: "Vul alle velden in.",
		passwordTooShort: "Gebruik een wachtwoord van minstens 8 tekens.",
		passwordPwned:
			"Dit wachtwoord is in een datalek gevonden. Kies een ander wachtwoord.",
		passwordDoesNotMeetRequirements:
			"Dit wachtwoord voldoet niet aan de eisen.",
		codeIncorrect: "Deze code klopt niet.",
		codeExpired: "Deze code is verlopen. Vraag een nieuwe aan.",
		codeAttemptsExceeded: "Te veel foute codes. Vraag een nieuwe aan.",
		tooManyRequests: "Te veel pogingen. Wacht even en probeer het opnieuw.",
		network: "De server is niet bereikbaar. Controleer je verbinding.",
		appleSignInIncomplete:
			"Inloggen met Apple is niet afgerond. Probeer het opnieuw.",
	},
	header: {
		accountMenu: "Accountmenu",
		account: "Profiel",
		signOut: "Uitloggen",
		signIn: "Inloggen",
	},
	profile: {
		loading: "Laden…",
		title: "Accountgegevens",
		firstName: "Voornaam",
		lastName: "Achternaam",
		email: "E-mail: {email}",
		save: "Profiel opslaan",
		security: "Beveiliging",
		currentPassword: "Huidig wachtwoord",
		newPassword: "Nieuw wachtwoord",
		changePassword: "Wachtwoord wijzigen",
		passwordChanged: "Wachtwoord gewijzigd. Andere apparaten zijn uitgelogd.",
		session: "Sessie",
		signOut: "Uitloggen",
	},
	signIn: {
		title: "Inloggen",
		subtitle: "Welkom terug bij Foundry.",
		submit: "Inloggen",
		forgotPassword: "Wachtwoord vergeten?",
		createAccount: "Account aanmaken",
		needsVerification: "Er is extra verificatie nodig.",
		emailCode: "Stuur me een inlogcode",
		codeUnavailable: "Inlogcodes zijn niet beschikbaar voor dit account.",
		codeSent: "We hebben een code van 6 cijfers gestuurd naar {email}.",
		code: "Code",
		verify: "Inloggen",
		resend: "Stuur een nieuwe code",
		resent: "Er is een nieuwe code onderweg.",
		usePassword: "Gebruik je wachtwoord",
	},
	secondFactor: {
		title: "Bevestig dat jij het bent",
		prompt: {
			totp: "Vul de code van 6 cijfers uit je authenticator-app in.",
			phone_code:
				"We hebben een code van 6 cijfers gesms't naar {destination}.",
			email_code:
				"We hebben een code van 6 cijfers gestuurd naar {destination}.",
			backup_code: "Vul een van de back-upcodes in die je hebt bewaard.",
		},
		yourPhone: "je telefoon",
		yourEmail: "je e-mailadres",
		code: "Code",
		backupCode: "Back-upcode",
		submit: "Bevestigen",
		resend: "Stuur een nieuwe code",
		resent: "Er is een nieuwe code onderweg.",
		switchTo: {
			totp: "Gebruik je authenticator-app",
			phone_code: "Sms een code naar {destination}",
			email_code: "Mail een code naar {destination}",
			backup_code: "Gebruik een back-upcode",
		},
		passwordChanged:
			"Je wachtwoord is gewijzigd. Nog één stap om in te loggen.",
		codeMissing: "Vul eerst de code in.",
		methodLocked:
			"Te veel foute codes voor deze methode. Gebruik een andere methode, of ga terug en log opnieuw in.",
		attemptEnded:
			"Deze inlogpoging duurde te lang en kan niet verder. Ga terug en log opnieuw in.",
		notFinished:
			"Deze inlogpoging kon niet worden afgerond. Ga terug en log opnieuw in.",
		noMethod:
			"De tweede inlogstap van je account is hier niet beschikbaar. Neem contact op met support om in te loggen.",
		backToSignIn: "Terug naar inloggen",
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
	session: {
		checking: "Je inlog wordt gecontroleerd…",
		stalled: "Dit duurt langer dan normaal",
		stalledHelp:
			"Probeer het opnieuw, of log opnieuw in als het blijft gebeuren.",
		retry: "Opnieuw proberen",
		signInAgain: "Opnieuw inloggen",
	},
	testLogin: {
		button: "▶ Dev: inloggen als testgebruiker",
		needsSteps: "De testgebruiker heeft extra stappen nodig.",
	},
} satisfies typeof enAuth;
