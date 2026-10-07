import { Stack } from "expo-router";
import { AccountScreen } from "../../src/features/profile/account-screen";
import { useI18n } from "../../src/i18n";

export default function AccountRoute() {
	const { t } = useI18n();
	return (
		<>
			<Stack.Screen options={{ title: t.profile.account }} />
			<AccountScreen />
		</>
	);
}
