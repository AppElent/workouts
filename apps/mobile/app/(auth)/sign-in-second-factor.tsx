import { useLocalSearchParams } from "expo-router";
import { SecondFactorScreen } from "../../src/auth/second-factor-screen";

export default function SignInSecondFactor() {
	const { from, sent } = useLocalSearchParams<{
		from?: string;
		sent?: string;
	}>();
	return (
		<SecondFactorScreen
			from={from === "reset" ? "reset" : "signIn"}
			sent={sent === "1"}
		/>
	);
}
