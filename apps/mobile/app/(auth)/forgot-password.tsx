import { useLocalSearchParams } from "expo-router";
import { ForgotPasswordScreen } from "../../src/auth/forgot-password-screen";

export default function ForgotPassword() {
	const { email } = useLocalSearchParams<{ email?: string }>();
	return <ForgotPasswordScreen email={email ?? ""} />;
}
