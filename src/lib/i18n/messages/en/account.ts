// Copy follows the mobile Account screen (apps/mobile/src/i18n/messages/account.ts).
export const account = {
	deletionTitle: "Delete data or account",
	deleteData: "Delete Foundry data only",
	deleteDataFooter:
		"Removes all your Foundry workouts, Routines, Runs and Rides, body metrics, foods, Combos, diary, goals and drafts, including Food photos, then signs you out here. Hosted workouts you host are deleted for everyone in them, and your scores leave the ones you joined. Your AppElent login stays, so Gather, Fairway and Arcade Club keep working, and signing in to Foundry again starts fresh. Export your data first if you want a copy.",
	deleteDataConfirm:
		"All your Foundry training and nutrition data, including saved drafts and Food photos, will be permanently removed from every device, and you are signed out here. Hosted workouts you host are deleted for everyone in them, and your scores leave the ones you joined. Your AppElent login stays and keeps working in Gather, Fairway and Arcade Club. This cannot be undone.",
	deleteAccount: "Delete my whole AppElent account",
	deleteAccountFooter:
		"Deletes your AppElent login, the one sign-in for Gather, Foundry, Fairway and Arcade Club, and your data in all four apps. Export your data first if you want a copy.",
	deleteAccountConfirm:
		"Your AppElent login is deleted, and with it your data in Gather, Foundry, Fairway and Arcade Club. You can no longer sign in to any of them with this account. This cannot be undone.",
	deleteAccountUnavailable:
		"Deleting the AppElent account is turned off. Delete your Foundry data instead, or contact support.",
	deletion: {
		dataDeleted: "Your Foundry data was deleted.",
		dataDeletedDetail:
			"Your AppElent login still works in Gather, Fairway and Arcade Club. Signing in to Foundry again starts fresh.",
		signOutError:
			"Your Foundry data was deleted, but you could not be signed out. Sign out from the menu.",
		error:
			"Deleting stopped before it finished. Reconnect and try again to delete the rest.",
		offline: "Connect to delete your data.",
		accountError:
			"Your data was deleted, but the account could not be deleted. Try Delete my whole AppElent account again.",
		signInCheckError:
			"Your sign-in could not be confirmed. Nothing was deleted. Try Delete my whole AppElent account again.",
		signInCheckAfterApple:
			"After the Apple step, your sign-in could not be confirmed, so your data and account were not deleted. Try Delete my whole AppElent account again.",
		signInAgain:
			"Your data was deleted, but the account was not, because your sign-in was not confirmed. Choose Delete my whole AppElent account again and confirm your sign-in. If that fails, sign out, sign in again and repeat.",
		appleContinue:
			"Next, Apple asks you to sign in so Foundry can stop using Sign in with Apple. Then your data and your AppElent account are deleted.",
		accountChanged:
			"You are signed in to a different account now, so that account was not deleted. Reload the page and check which account you are in.",
		applePopupBlocked:
			"Your browser blocked the Apple window. Allow pop-ups for this site, then try Delete my whole AppElent account again.",
		refusals: {
			activeActivity:
				"Finish or cancel the running Activity before deleting your data.",
			hostedWorkout:
				"This account is involved in a Hosted Workout. Deleting is unavailable to protect shared records.",
		},
	},
};
