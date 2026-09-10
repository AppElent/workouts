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
		offline: "Offline — changes will sync when you reconnect",
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
			closeServingLabel: "Close serving options",
			closeServing: "Done",
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
		combos: {
			create: "Create Combo",
			log: "Log Combo",
			storageTitle: "Stored only on this device",
			storageBody:
				"Combos are available offline on this device, do not appear on a second device, and may be lost if you uninstall Workouts. Logging syncs with your diary when connected.",
			name: "Combo name",
			save: "Save Combo",
			saving: "Saving Combo…",
			saved: "Combo saved.",
			saveFailure:
				"This Combo could not be saved. Your name and selection are still here.",
			selectionHelp:
				"Choose individual diary entries. Meal slots are never selected automatically.",
			selectEntry: "Select {name} for Combo",
			cancel: "Cancel",
			continueOne: "Continue with 1 part",
			continueMany: "Continue with {count} parts",
			destination: "Log to meal",
			logOne: "Log 1 part",
			logMany: "Log {count} parts",
			logging: "Logging Combo…",
			logFailure:
				"This Combo could not be logged. Your selection is still here.",
			partsOne: "1 part",
			partsMany: "{count} parts",
			needsAttention: "Needs attention",
			missing: "Missing source",
			missingBody:
				"A saved food is no longer on this device. It was not replaced automatically. Remove unavailable parts, delete this Combo, or recreate it from the entries you want.",
			resolveTitle: "Remove unavailable parts?",
			resolveBody:
				"Only the parts whose original sources are still available will remain in this Combo.",
			resolve: "Remove unavailable parts",
			resolveFailure: "The unavailable parts could not be removed.",
			emptyTitle: "No Combos yet",
			emptyBody: "Create one by selecting individual entries from your diary.",
			deleteTitle: "Delete this Combo?",
			deleteBody:
				"Previously logged groups keep their saved nutrition snapshots.",
			delete: "Delete Combo",
			deleting: "Deleting Combo…",
			deleteFailure: "This Combo could not be deleted.",
			expandGroup: "Expand Combo {name}",
			collapseGroup: "Collapse Combo {name}",
		},

		/**
		 * Correcting a shipped food (#75). A correction never edits the shipped
		 * record: it creates the user's own food that stands in front of it. The
		 * copy says "your correction", never "the fixed version", because nothing
		 * here claims the user is right and NEVO is wrong.
		 */
		fork: {
			correct: "Correct this food",
			title: "Correct a shipped food",
			intro:
				"This saves your own copy. The bundled food is left as published, and your copy replaces it in ordinary search.",
			/** Caption under a fork, wherever it appears. */
			resultLabel: "Your correction",
			forkedFrom: "Your correction of {name}",
			locallyEdited: "You changed these figures.",
			unchanged: "You have not changed these figures yet.",
			/** Caption on the original, in the deliberate broader view only. */
			shadowed: "Replaced by your correction",
			deleteTitle: "Delete this correction?",
			deleteBody:
				"The bundled food returns to search. Diary entries keep the nutrition they were logged with.",
		},

		offline: {
			title: "Your diary for this day is not on this phone yet",
			body: "It will appear as soon as you are back online. You can still search foods and log them now — entries are sent when you reconnect.",
			slot: "Not available offline",
		},

		entryActions: {
			/** Names the subject so the menu is not two verbs with no object. */
			menuTitle: "{name}",
			close: "Close",
			/** Short: this label also rides an 88pt swipe button. */
			edit: "Edit",
			delete: "Delete",
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
