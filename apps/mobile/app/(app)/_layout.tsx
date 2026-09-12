/**
 * The signed-in shell.
 *
 * The guard is Clerk's `isSignedIn`, never Convex's `isAuthenticated`. The two
 * disagree for the length of the JWT handshake right after sign-in, and
 * guarding on the Convex side produces an infinite bounce between this group
 * and `(auth)`.
 *
 * A plain Stack, and it stays one. The tab bar lives in the nested `(coach)`
 * group, which is a screen of this stack — expo-router keeps navigation state
 * per route and crashes if a route's navigator type changes underneath it, so
 * `NativeTabs` gets its own route rather than replacing this one.
 *
 */
import { useAuth } from "@clerk/expo";
import { Redirect, Stack, useSegments } from "expo-router";
import { useEffect, useState } from "react";
import { Platform, View } from "react-native";
import { NutritionOperationsProvider } from "../../src/data/nutrition-operation-service";
import { OpenFoodFactsProvider } from "../../src/data/open-food-facts-context";
import { PersonalFoodsProvider } from "../../src/data/personal-foods";
import { useI18n } from "../../src/i18n";
import { colors } from "../../src/theme";
import { ConfirmProvider } from "../../src/ui/confirm-dialog";
import { OfflineBanner } from "../../src/ui/offline-banner";
import { RestTimerProvider } from "../../src/ui/rest-timer";
import { ToastProvider } from "../../src/ui/toast";

export default function AppLayout() {
	const { isSignedIn } = useAuth();
	const { t, locale } = useI18n();
	const segments = useSegments();
	const tab = segments[segments.length - 1];
	const selectedTab =
		tab === "train"
			? "train"
			: tab === "nutrition"
				? "nutrition"
				: tab === "progress"
					? "progress"
					: tab === "profile"
						? "profile"
						: "home";
	const inTabs = segments.includes("(coach)" as never);
	const [lastTab, setLastTab] = useState<keyof typeof t.tabs>("home");
	useEffect(() => {
		if (inTabs) setLastTab(selectedTab);
	}, [inTabs, selectedTab]);
	// A pushed screen must keep the previous tab's title for the native Back menu.
	const tabTitle = t.tabs[inTabs ? selectedTab : lastTab];

	if (!isSignedIn) {
		return <Redirect href="/sign-in" />;
	}

	return (
		<ToastProvider>
			<ConfirmProvider>
				<RestTimerProvider>
					<PersonalFoodsProvider>
						<OpenFoodFactsProvider>
							<NutritionOperationsProvider>
								<View style={{ flex: 1, backgroundColor: colors.bg }}>
									<OfflineBanner />
									<Stack
										screenOptions={{
											headerShown: true,
											headerTintColor: colors.accent,
											gestureEnabled: true,
											contentStyle: { backgroundColor: colors.bg },
											...(Platform.OS === "android"
												? {
														headerStyle: { backgroundColor: colors.bg },
														headerTitleStyle: { color: colors.text },
														headerShadowVisible: false,
													}
												: {}),
										}}
									>
										<Stack.Screen
											name="(coach)"
											options={{
												title: tabTitle,
												headerBackVisible: false,
											}}
										/>
										<Stack.Screen
											name="exercises"
											options={{ title: "Exercises" }}
										/>
										<Stack.Screen
											name="exercise/[id]"
											options={{ title: "Exercise" }}
										/>
										<Stack.Screen
											name="hosted"
											options={{ title: "Hosted workouts" }}
										/>
										<Stack.Screen
											name="hosted/[id]"
											options={{ title: "Hosted workout" }}
										/>
										<Stack.Screen name="wods" options={{ title: "WODs" }} />
										<Stack.Screen name="wod/[id]" options={{ title: "WOD" }} />
										<Stack.Screen
											name="start-activity"
											options={{ title: "Start activity" }}
										/>
										<Stack.Screen
											name="session"
											options={{ title: "Workout" }}
										/>
										<Stack.Screen
											name="summary"
											options={{
												title: "Summary",
												headerBackVisible: false,
												gestureEnabled: false,
											}}
										/>
										<Stack.Screen
											name="language"
											options={{ title: t.language.title }}
										/>
										<Stack.Screen
											name="nutrition-food"
											options={{ title: t.nutrition.foodBrowser.addFood }}
										/>
										<Stack.Screen
											name="nutrition-entry"
											options={{ title: t.nutrition.entryEditor.title }}
										/>
										<Stack.Screen
											name="nutrition-combos"
											options={{ title: t.nutrition.combos.log }}
										/>
										<Stack.Screen
											name="nutrition-copy"
											options={{ title: t.nutrition.copyMeal.title }}
										/>
										<Stack.Screen
											name="nutrition-combo-new"
											options={{ title: t.nutrition.combos.create }}
										/>
										<Stack.Screen
											name="nutrition-goals"
											options={{ title: t.nutrition.goalEditor.title }}
										/>
										<Stack.Screen
											name="nutrition-cooking"
											options={{
												title:
													locale === "nl"
														? "Koken en snel vastleggen"
														: "Cooking and quick capture",
											}}
										/>
										<Stack.Screen
											name="nutrition-assistance"
											options={{
												title:
													locale === "nl"
														? "Hulp bij invoeren"
														: "Logging assistance",
											}}
										/>
										<Stack.Screen
											name="nutrition-weekly-review"
											options={{
												title:
													locale === "nl" ? "Weekoverzicht" : "Weekly review",
											}}
										/>
										<Stack.Screen
											name="nutrition-library"
											options={{
												title:
													locale === "nl"
														? "Voedingsbibliotheek"
														: "Food library",
											}}
										/>
									</Stack>
								</View>
							</NutritionOperationsProvider>
						</OpenFoodFactsProvider>
					</PersonalFoodsProvider>
				</RestTimerProvider>
			</ConfirmProvider>
		</ToastProvider>
	);
}
