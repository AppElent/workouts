import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Platform, StyleSheet, View } from "react-native";
import type { Id } from "../../src/convex/api";
import { useRoutines, useShellData } from "../../src/data/session-data";
import { RoutineEditor } from "../../src/screens/routine-editor";
import { colors } from "../../src/theme";
import { AppText } from "../../src/ui/text";

export default function RoutineEditorRoute() {
	const router = useRouter();
	const { id } = useLocalSearchParams<{ id?: string }>();
	const routines = useRoutines();
	const { exercises } = useShellData();
	const routine = id
		? routines?.find((candidate) => candidate._id === (id as Id<"routines">))
		: null;
	const close = () => router.back();

	if (id && routines === undefined) {
		return <Status label="Loading routine…" />;
	}
	if (id && !routine) {
		return <Status label="Routine not found" />;
	}

	return (
		<>
			<RoutineEditor
				presentation="screen"
				routine={routine}
				exercises={exercises}
				onClose={close}
			/>
			{Platform.OS === "ios" ? (
				<Stack.Toolbar placement="left">
					<Stack.Toolbar.Button onPress={close}>Cancel</Stack.Toolbar.Button>
				</Stack.Toolbar>
			) : null}
		</>
	);
}

function Status({ label }: { label: string }) {
	return (
		<View style={styles.status}>
			<AppText variant="caption">{label}</AppText>
		</View>
	);
}

const styles = StyleSheet.create({
	status: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: colors.bg,
	},
});
