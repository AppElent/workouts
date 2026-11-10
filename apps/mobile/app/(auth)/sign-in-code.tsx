import { useLocalSearchParams } from "expo-router";
import { SignInCodeScreen } from "../../src/auth/sign-in-code-screen";

export default function SignInCode() {
	const { email } = useLocalSearchParams<{ email?: string }>();
	return <SignInCodeScreen email={email ?? ""} />;
}
