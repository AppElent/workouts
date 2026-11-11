import type { AppErrorMessages } from "@foundry/core";

/** What a server failure code means to the person, whatever they were doing. */
export const errorsEn = {
	unauthenticated: "Sign in again to continue.",
	accountChanged:
		"Your signed-in account changed. Reopen this screen and try again.",
	readOnly: "This is built in and can't be changed.",
	duplicate: "This already exists.",
	operationConflict:
		"This conflicts with a change that was already saved. Refresh and try again.",
	recordDeleted: "This was deleted on another device.",
	activeSessionExists:
		"An activity is already running. Finish or cancel it first.",
	sessionEnded: "This activity has already ended.",
	emptySession: "Log at least one set or result before finishing.",
	hostedNotDraft: "This hosted workout is already open and can't be edited.",
	hostedNotOpen: "This hosted workout is not open.",
	hostedClosed: "This hosted workout has closed.",
	templateEmpty: "Add at least one block to the hosted workout.",
	levelsIncomplete: "Fill in every level for each block.",
	unavailable: "This is not available right now. Try again later.",
	limit: "You reached today's limit. Try again tomorrow.",
} satisfies AppErrorMessages;

export const errorsNl: typeof errorsEn = {
	unauthenticated: "Log opnieuw in om verder te gaan.",
	accountChanged:
		"Je bent met een ander account ingelogd. Open dit scherm opnieuw en probeer het nogmaals.",
	readOnly: "Dit is ingebouwd en kan niet worden gewijzigd.",
	duplicate: "Dit bestaat al.",
	operationConflict:
		"Dit botst met een wijziging die al is opgeslagen. Ververs en probeer het opnieuw.",
	recordDeleted: "Dit is op een ander toestel verwijderd.",
	activeSessionExists:
		"Er loopt al een activiteit. Rond deze eerst af of annuleer hem.",
	sessionEnded: "Deze activiteit is al afgelopen.",
	emptySession: "Log minstens één set of resultaat voordat je afrondt.",
	hostedNotDraft:
		"Deze groepstraining is al geopend en kan niet meer worden bewerkt.",
	hostedNotOpen: "Deze groepstraining is niet geopend.",
	hostedClosed: "Deze groepstraining is gesloten.",
	templateEmpty: "Voeg minstens één blok toe aan de groepstraining.",
	levelsIncomplete: "Vul elk niveau in voor elk blok.",
	unavailable: "Dit is nu niet beschikbaar. Probeer het later opnieuw.",
	limit: "Je hebt de limiet voor vandaag bereikt. Probeer het morgen opnieuw.",
};
