import * as Sentry from "@sentry/react-native";
import * as Updates from "expo-updates";

// A DSN is public client configuration, not an upload/auth token. Keep Foundry
// working in every build, with an optional override for a separate test project.
Sentry.init({
	dsn:
		process.env.EXPO_PUBLIC_SENTRY_DSN ||
		"https://43d3de8058924d6c718b133785d811c8@o4504753234051072.ingest.us.sentry.io/4512164168663040",
	environment: Updates.channel || (__DEV__ ? "development" : "production"),
	sendDefaultPii: false,
});
