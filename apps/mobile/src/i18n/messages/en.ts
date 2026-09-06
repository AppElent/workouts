/**
 * The phone's words, in the source language.
 *
 * English is written here and Dutch follows in `nl.ts`, which is typed
 * `satisfies typeof en` — so a key added here without a Dutch counterpart is a
 * `pnpm --filter @workouts/mobile typecheck` failure rather than a blank label
 * discovered on a device.
 *
 * Deliberately not shared with the web app's `src/lib/i18n/messages/`. There is
 * no web Nutrition UI (it is out of scope in the spec), so sharing would buy
 * nothing and would couple the two clients' release cadence.
 *
 * No `as const`. The literal types it would produce are exactly what stops
 * `nl.ts` from satisfying this shape.
 */
export const en = {
	tabs: {
		home: "Home",
		train: "Train",
		nutrition: "Nutrition",
		progress: "Progress",
		profile: "Profile",
	},

	common: {
		back: "Go back",
		retry: "Try again",
	},

	preferences: {
		heading: "Preferences",
		units: "Units",
		notifications: "Notifications",
		connectedApps: "Connected apps",
		language: "Language",
	},

	language: {
		title: "Language",
		description:
			"Workouts starts in your phone's language and stays in the one you choose here.",
		names: {
			en: "English",
			nl: "Nederlands",
		},
	},

	nutrition: {
		title: "Nutrition",

		day: {
			today: "Today",
			yesterday: "Yesterday",
			tomorrow: "Tomorrow",
			previousDay: "Previous day",
			nextDay: "Next day",
			goToToday: "Go to today",
			loading: "Loading the day",
		},

		/**
		 * A purely decorative acknowledgement — see spec #68. Never mentions
		 * duration, intensity, calories, or energy balance, because the marker
		 * carries none of those and never will.
		 */
		trainingMarker: {
			label: "Trained",
			description: "You completed a training session on this day.",
		},

		goals: {
			heading: "Goals",
			edit: "Edit goals",
			empty: {
				title: "No goals yet",
				body: "Set a daily amount for the nutrients you care about, and the day fills in against them.",
				action: "Set up goals",
			},
			/** "1,426 of 2,100 kcal" */
			progress: "{total} of {target} {unit}",
			state: {
				neutral: "Nothing logged",
				under: "Under",
				met: "Met",
				within: "Within",
				exceeded: "Over",
			},
		},
		goalEditor: {
			title: "Your nutrition goals",
			intro:
				"Choose a static starting point or set any minimum or maximum yourself. These values do not use Activity or body data.",
			loading: "Loading goals",
			amount: "Daily amount",
			remove: "Remove",
			save: "Save goals",
			saving: "Saving goals…",
			validation: "Enter an amount greater than zero.",
			failure: "Your goals could not be saved. Your changes are still here.",
			edited: "{count} edited",
			directions: { min: "Minimum", max: "Maximum" },
			presets: {
				reference: {
					name: "Reference intake",
					provenance:
						"EU Regulation 1169/2011 Annex XIII and EFSA fibre guidance.",
				},
				loseWeight: {
					name: "Lose weight",
					provenance:
						"Fixed Reference intake variant: energy −300 kcal. Not personalised advice.",
				},
				buildMuscle: {
					name: "Build muscle",
					provenance:
						"Fixed Reference intake variant: energy +300 kcal and protein +50 g. Not personalised advice.",
				},
			},
		},

		meals: {
			breakfast: "Breakfast",
			lunch: "Lunch",
			dinner: "Dinner",
			snacks: "Snacks",
		},

		/** The accessible name of a meal slot's icon-only plus control. */
		addTo: "Add food to {meal}",
		mealEmpty: "Nothing logged yet. Use + to add a food.",
		foodBrowser: {
			title: "Find food for {meal}",
			searchPlaceholder: "Search foods",
			scanBarcode: "Scan barcode",
			searchAll: "Search all 2,328 foods",
			searchOnline: "Search Open Food Facts",
			searchingOnline: "Searching Open Food Facts…",
			onlineResults: "Open Food Facts results",
			showMore: "Show more foods",
			promotedResults: "Everyday foods",
			allResults: "All NEVO foods",
			empty: "No foods match this search.",
			per100: "Nutrition per 100",
			serving: "Serving",
			quantity: "Quantity",
			trace: "Trace",
			absent: "Not available",
			log: "Log food",
			logging: "Logging food…",
			logFailure:
				"This food could not be logged. Your selection is still here.",
		},
		/**
		 * Every message here is a failure exit, not just a status line — spec #68
		 * requires local Search and Enter manually to stay reachable behind each
		 * one, so none of these ever block the screen; they surface as a toast
		 * and return to the ordinary Find Food view.
		 */
		barcode: {
			scanTitle: "Scan barcode",
			purpose:
				"Allow camera access to scan food barcodes and find nutrition information.",
			allow: "Allow camera access",
			requesting: "Requesting camera access…",
			denied:
				"Camera access was refused. You can still find food with Search or Enter manually.",
			restricted:
				"Camera access is restricted on this device. You can still find food with Search or Enter manually.",
			hint: "Point your camera at a barcode.",
			lookingUp: "Looking up this barcode…",
		},
		foodImport: {
			reviewTitle: "Review imported food",
			reviewBody:
				"Open Food Facts data can be incomplete or use different names — check these figures before saving. Saving creates a Personal Food you can edit any time.",
			notFound: "No product was found for this barcode.",
			searchNotFound: "No Open Food Facts products matched your search.",
			rateLimited:
				"Open Food Facts is receiving too many requests right now. Try again shortly.",
			timeout: "The Open Food Facts request timed out.",
			networkError:
				"Could not reach Open Food Facts. Check your connection and try again.",
			incomplete: "This product has too little nutrition data to import.",
			invalid: "This product's data could not be read.",
		},
		personalFood: {
			createTitle: "Create Personal Food",
			editTitle: "Edit Personal Food",
			resultLabel: "Personal Food",
			storageTitle: "Stored only on this device",
			storageBody:
				"Personal Foods do not appear on a second device and may be lost if you uninstall Workouts. Platform backup is best effort only.",
			nameEn: "English name",
			nameNl: "Dutch name",
			baseUnit: "Nutrition base unit",
			grams: "Grams",
			millilitres: "Millilitres",
			per100: "Nutrition per 100",
			states: { absent: "Not available", trace: "Trace", value: "Amount" },
			servings: "Servings",
			servingsHelp: "Add up to three familiar amounts in the base unit.",
			englishLabel: "English label",
			dutchLabel: "Dutch label",
			amountIn: "amount in",
			addServing: "Add Serving",
			removeServing: "Remove Serving",
			save: "Save Personal Food",
			saving: "Saving Personal Food…",
			cancel: "Cancel",
			deleteTitle: "Delete this Personal Food?",
			deleteBody:
				"Its existing Diary Entries keep their saved nutrition snapshot.",
			delete: "Delete Personal Food",
			deleteFailure: "This Personal Food could not be deleted.",
			validation: "Check the highlighted Personal Food values.",
			saveFailure:
				"This Personal Food could not be saved. Your changes are still here.",
		},

		entryEditor: {
			title: "Edit entry",
			/** Icon-free row, so this is the whole accessible name. */
			editEntry: "Edit entry: {name}",
			meal: "Meal",
			date: "Date",
			save: "Save changes",
			saving: "Saving…",
			saveFailure:
				"This entry could not be updated. Your changes are still here.",
			delete: "Delete entry",
			deleting: "Deleting…",
			deleteFailure:
				"This entry could not be deleted. It is still in your diary.",
			deleteConfirmTitle: "Delete this entry?",
			deleteConfirmMessage: "{name} will be removed from {meal} on {date}.",
			keepEntry: "Keep entry",
		},

		otherNutrients: {
			heading: "Other nutrients",
			show: "Show other nutrients",
			hide: "Hide other nutrients",
		},

		nutrients: {
			energy: "Energy",
			protein: "Protein",
			carbs: "Carbohydrates",
			fat: "Fat",
			saturatedFat: "Saturated fat",
			fibre: "Fibre",
			sugars: "Sugars",
			salt: "Salt",
		},

		units: {
			kcal: "kcal",
			g: "g",
		},

		attribution: {
			nevo: "Nutrition figures include NEVO 2025/9.0 data.",
			salt: "Salt is derived by Appelent from the source's sodium.",
			incomplete: "Totals are marked where source values are absent.",
		},

		error: {
			title: "This day could not be opened",
			body: "Something went wrong while building the view.",
		},
	},
};

/** The shape every locale has to provide. */
export type Messages = typeof en;
