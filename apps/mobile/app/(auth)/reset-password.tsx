import { useLocalSearchParams } from "expo-router";
import { ResetPasswordScreen } from "../../src/auth/reset-password-screen";

export default function ResetPassword() {
	const { email } = useLocalSearchParams<{ email?: string }>();
	return <ResetPasswordScreen email={email ?? ""} />;
}
