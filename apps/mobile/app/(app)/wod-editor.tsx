import { useQuery } from "convex/react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Platform, StyleSheet, View } from "react-native";
import { api, type Id } from "../../src/convex/api";
import { WodEditor } from "../../src/screens/wod-editor";
import { colors } from "../../src/theme";
import { AppText } from "../../src/ui/text";

export default function WodEditorRoute() {
	const router = useRouter();
	const { id } = useLocalSearchParams<{ id?: string }>();
	const wodId = id as Id<"wods"> | undefined;
	const wod = useQuery(api.wods.getById, wodId ? { id: wodId } : "skip");
	const close = () => router.back();

	if (wodId && wod === undefined) return <Status label="Loading WOD…" />;
	if (wodId && !wod) return <Status label="WOD not found" />;

	return (
		<>
			<WodEditor presentation="screen" wod={wod ?? null} onClose={close} />
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
