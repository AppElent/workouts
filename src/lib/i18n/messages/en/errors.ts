import type { AppErrorMessages } from "@foundry/core";

/** What a server failure code means to the person, whatever they were doing. */
export const errors = {
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
	unfinishedTargets:
		"Some planned sets are not logged yet. Log them or finish without them.",
	hostedNotDraft: "This hosted workout is already open and can't be edited.",
	hostedNotOpen: "This hosted workout is not open.",
	hostedClosed: "This hosted workout has closed.",
	templateEmpty: "Add at least one block to the hosted workout.",
	levelsIncomplete: "Fill in every level for each block.",
	unavailable: "This is not available right now. Try again later.",
	limit: "You reached today's limit. Try again tomorrow.",
} satisfies AppErrorMessages;
