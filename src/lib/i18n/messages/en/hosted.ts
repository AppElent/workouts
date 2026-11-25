type HostedStatus = "draft" | "open" | "closed";

export const hosted = {
	paused: {
		title: "Hosted Workouts are paused",
		description:
			"Hosting and joining group workouts is switched off for now. Your own sessions, WODs, and scores are not affected.",
		home: "Go to Foundry",
	},
	join: {
		loading: "Loading...",
		notFound: "Hosted workout not found.",
		status: {
			draft: "Draft",
			open: "Open",
			closed: "Closed",
		} satisfies Record<HostedStatus, string>,
		yourName: "Your name",
		namePlaceholder: "Name on leaderboard",
		join: "Join workout",
		joining: "Joining...",
		joinFailed: "Failed to join workout.",
		signIn: "Sign in to join",
		closed: "This workout has closed. Scores are final.",
		notStarted:
			"This workout hasn't started yet. Check back once the host opens it.",
		host: "Host",
		signedInAthlete: "Signed-in athlete",
	},
	guest: {
		name: "Guest name",
		namePlaceholder: "Name on leaderboard",
		submit: "Submit guest score",
	},
	blocks: {
		strength: "Strength",
		timeCap: "Time cap {time}",
		minutes: "{count} min",
		noMovements: "No movements",
		rank: "#",
		athlete: "Athlete",
		level: "Level",
		score: "Score",
		noScores: "No scores yet.",
		removeScore: "Remove score",
	},
	scoreForm: {
		title: "Submit score",
		submit: "Submit score",
		submitHosted: "Submit hosted score",
		submitting: "Submitting...",
		submitted: "Score submitted.",
		failed: "Failed to submit score.",
		wod: "WOD",
		notes: "Notes (optional)",
		noWods: "This hosted workout has no WOD scores to submit.",
	},
	claim: {
		title: { one: "Keep your guest score", other: "Keep your guest scores" },
		signedIn: {
			one: "Add your guest score from this device to your training history.",
			other: "Add your guest scores from this device to your training history.",
		},
		signedInShared:
			"Several people scored on this device. Add only the scores under your own name to your training history.",
		signedOut: {
			one: "Create a free account to save your guest score in your own training history.",
			other:
				"Create a free account to save your guest scores in your own training history.",
		},
		add: "Add to my history",
		addAs: "I'm {name} ({count})",
		adding: "Adding...",
		createAccount: "Create account",
		failed: "Couldn't add your scores. Try again.",
	},
};
