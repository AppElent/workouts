export const secondFactorEn = {
	title: "Verify it's you",
	prompt: {
		totp: "Enter the 6-digit code from your authenticator app.",
		phone_code: "We texted a 6-digit code to {destination}.",
		email_code: "We sent a 6-digit code to {destination}.",
		backup_code: "Enter one of the backup codes you saved.",
	},
	/** Shown when Clerk gives no masked number or address. */
	yourPhone: "your phone",
	yourEmail: "your email",
	code: "Code",
	backupCode: "Backup code",
	submit: "Verify",
	resend: "Send a new code",
	resent: "A new code is on its way.",
	switchTo: {
		totp: "Use your authenticator app",
		phone_code: "Text a code to {destination}",
		email_code: "Email a code to {destination}",
		backup_code: "Use a backup code",
	},
	passwordChanged: "Your password is changed. One more step to sign in.",
	codeLocked: "Too many wrong codes. Send a new one.",
	methodLocked:
		"Too many wrong codes for this method. Use another one below, or go back and sign in again.",
	onlyMethodLocked: "Too many wrong codes. Go back and sign in again.",
	attemptEnded:
		"This sign-in took too long and can't continue. Go back and sign in again.",
	noMethod:
		"Your account's second step isn't available in this app. Sign in on the web app instead.",
	backToSignIn: "Back to sign in",
};

export const secondFactorNl: typeof secondFactorEn = {
	title: "Bevestig dat jij het bent",
	prompt: {
		totp: "Vul de code van 6 cijfers uit je authenticator-app in.",
		phone_code: "We hebben een code van 6 cijfers ge-sms't naar {destination}.",
		email_code: "We hebben een code van 6 cijfers gestuurd naar {destination}.",
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
		totp: "Authenticator-app gebruiken",
		phone_code: "Sms een code naar {destination}",
		email_code: "Mail een code naar {destination}",
		backup_code: "Back-upcode gebruiken",
	},
	passwordChanged: "Je wachtwoord is gewijzigd. Nog één stap om in te loggen.",
	codeLocked: "Te veel foute codes. Vraag een nieuwe aan.",
	methodLocked:
		"Te veel foute codes voor deze methode. Kies hieronder een andere, of ga terug en log opnieuw in.",
	onlyMethodLocked: "Te veel foute codes. Ga terug en log opnieuw in.",
	attemptEnded:
		"Deze inlogpoging duurde te lang en kan niet verder. Ga terug en log opnieuw in.",
	noMethod:
		"De tweede stap van je account is niet beschikbaar in deze app. Log in via de webapp.",
	backToSignIn: "Terug naar inloggen",
};
