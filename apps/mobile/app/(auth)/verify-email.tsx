import { useLocalSearchParams } from "expo-router";
import { VerifyEmailScreen } from "../../src/auth/verify-email-screen";

export default function VerifyEmail() {
	const { email } = useLocalSearchParams<{ email?: string }>();
	return <VerifyEmailScreen email={email ?? ""} />;
}
