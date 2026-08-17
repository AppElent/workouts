/**
 * Throwaway placeholder screen (issue #44). Its only job is proving the
 * chain works end to end: signed in via Clerk, real data from Convex,
 * nothing invented client-side. `exercises.list` is a query — no writes —
 * so it's the cheapest possible proof.
 *
 * No shell, no navigation, no design system: that's #46. No log-workout UI:
 * that's #47. This screen is not meant to survive either ticket.
 */
import { useAuth } from "@clerk/expo";
import { useQuery } from "convex/react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import type { Doc } from "../../src/convex/api";
import { api } from "../../src/convex/api";

export default function Home() {
	const { signOut } = useAuth();
	const exercises = useQuery(api.exercises.list, {});

	return (
		<View style={styles.root}>
			<View style={styles.header}>
				<Text style={styles.heading}>Exercises</Text>
				<Pressable onPress={() => signOut()} hitSlop={8}>
					<Text style={styles.signOut}>Sign out</Text>
				</Pressable>
			</View>

			{exercises === undefined ? (
				<Text style={styles.status}>Loading…</Text>
			) : exercises.length === 0 ? (
				<Text style={styles.status}>No exercises yet.</Text>
			) : (
				<FlatList
					data={exercises}
					keyExtractor={(item) => item._id}
					contentContainerStyle={styles.list}
					renderItem={({ item }: { item: Doc<"exercises"> }) => (
						<View style={styles.row}>
							<Text style={styles.name}>{item.name}</Text>
							<Text style={styles.meta}>
								{item.category} · {item.equipment}
							</Text>
						</View>
					)}
				/>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	root: {
		flex: 1,
		backgroundColor: "#000000",
		paddingTop: 64,
		paddingHorizontal: 20,
	},
	header: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		marginBottom: 16,
	},
	heading: {
		fontSize: 24,
		fontWeight: "800",
		color: "#ffffff",
	},
	signOut: {
		color: "#1DB954",
		fontSize: 14,
		fontWeight: "600",
	},
	status: {
		color: "#b3b3b3",
		fontSize: 14,
		marginTop: 24,
		textAlign: "center",
	},
	list: {
		gap: 8,
		paddingBottom: 40,
	},
	row: {
		backgroundColor: "#1a1a1a",
		borderRadius: 12,
		borderWidth: 1,
		borderColor: "rgba(255,255,255,0.1)",
		paddingHorizontal: 16,
		paddingVertical: 12,
	},
	name: {
		color: "#ffffff",
		fontSize: 15,
		fontWeight: "600",
	},
	meta: {
		color: "#b3b3b3",
		fontSize: 12,
		marginTop: 2,
		textTransform: "capitalize",
	},
});
