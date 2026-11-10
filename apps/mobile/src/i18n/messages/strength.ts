import { strengthSessionEn, strengthSessionNl } from "./strength-session";

export const strengthEn = {
	plan: strengthSessionEn,
	freeSession: "Free session",
	noActive: "No active session",
	checking: "Checking session…",
	unavailable: "Session unavailable",
	unavailableHint:
		"Connect to verify this session before saving. Your unfinished set stays on this device.",
	ended: "This session has ended. Unfinished sets cannot be logged.",
	saveError: "Could not save. Your input has been kept.",
	warmup: "Warm-up",
	working: "Working",
	drop: "Drop",
	failure: "Failure",
	unverifiedHistory:
		"Includes historical values whose performance source is unverified.",
};
export const strengthNl: typeof strengthEn = {
	plan: strengthSessionNl,
	freeSession: "Vrije sessie",
	noActive: "Geen actieve sessie",
	checking: "Sessie controleren…",
	unavailable: "Sessie niet beschikbaar",
	unavailableHint:
		"Maak verbinding om deze sessie te controleren voordat je opslaat. Je onvoltooide set blijft op dit toestel.",
	ended:
		"Deze sessie is beëindigd. Onvoltooide sets kunnen niet meer worden vastgelegd.",
	saveError: "Opslaan is niet gelukt. Je invoer is bewaard.",
	warmup: "Warming-up",
	working: "Werkset",
	drop: "Dropset",
	failure: "Tot falen",
	unverifiedHistory:
		"Bevat historische waarden waarvan de prestatiebron niet is bevestigd.",
};
