/** Your references for one exercise, and every load they imply, inside a session. */
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useMemo } from "react";
import type { Id } from "../../convex/api";
import { useI18n } from "../../i18n";
import { useTokens } from "../../theme";
import { StrengthProfileView } from "./components/strength-profile-view";
import { useSessionActions } from "./data/session-actions";
import { useSessionWorkspace, workspaceStore } from "./data/session-workspace";
import {
	bestToday,
	findRow,
	type PlanSet,
	referenceFor,
	updateRow,
} from "./session-plan";

export function StrengthProfileScreen() {
	const params = useLocalSearchParams<{
		sessionId: Id<"workoutSessions">;
		exerciseId: string;
		rowId?: string;
	}>();
	const workspace = useSessionWorkspace(params.sessionId);
	const actions = useSessionActions(workspace);
	const { key, plan, drafts, getFacts, nameOf } = workspace;
	const router = useRouter();
	const { t } = useI18n();
	const copy = t.strength.plan.profile;
	const colors = useTokens();
	const exerciseId = params.exerciseId;
	const facts = getFacts(exerciseId);
	const screenTitle = `${copy.title} · ${nameOf(exerciseId)}`;
	const screenOptions = useMemo(
		() => ({ title: screenTitle, headerTitleStyle: { color: colors.text } }),
		[screenTitle, colors.text],
	);
	if (!plan) return <Stack.Screen options={{ title: copy.title }} />;
	const stored = params.rowId ? findRow(plan, params.rowId) : undefined;
	const row = (params.rowId && drafts[params.rowId]) || stored;
	const local = plan.manual[exerciseId];
	const manual =
		typeof local === "number"
			? { value: local, date: null }
			: local === undefined && facts.savedManual
				? facts.savedManual
				: null;
	const close = () => {
		if (router.canGoBack()) router.back();
		else router.dismiss();
	};
	function apply(chosen: PlanSet) {
		if (!row) return;
		// A send with an unknown result froze this set: its values must match it.
		if (row.attempt) {
			actions.say(t.strength.plan.editor.lockedUnknown);
			close();
			return;
		}
		if (row.done) workspaceStore.setDraft(key, row.id, chosen);
		else actions.set(updateRow(actions.plan(), row.id, chosen));
		close();
	}
	return (
		<>
			<Stack.Screen options={screenOptions} />
			<StrengthProfileView
				facts={facts}
				reference={referenceFor(plan, facts, exerciseId)}
				manual={manual}
				today={bestToday(plan, exerciseId, facts)}
				row={row || undefined}
				onApply={apply}
				onEnterOneRm={() => {
					if (actions.blocked()) return;
					router.push({
						pathname: "/session-manual",
						params: { sessionId: params.sessionId, exerciseId },
					});
				}}
			/>
		</>
	);
}
