import { Stack, useRouter } from "expo-router";
import { Platform } from "react-native";
import { AddExerciseForm } from "../../src/screens/add-exercise-form";

export default function NewExerciseRoute() {
	const router = useRouter();
	const close = () => router.back();
	return (
		<>
			<AddExerciseForm presentation="screen" onClose={close} />
			{Platform.OS === "ios" ? (
				<Stack.Toolbar placement="left">
					<Stack.Toolbar.Button onPress={close}>Cancel</Stack.Toolbar.Button>
				</Stack.Toolbar>
			) : null}
		</>
	);
}
