import { type Href, useNavigation, useRouter } from "expo-router";
import { usePreventRemove } from "expo-router/build/react-navigation/core";
import {
	createContext,
	type ReactNode,
	useContext,
	useEffect,
	useRef,
	useState,
} from "react";
import type { Id } from "../../convex/api";
import { useI18n } from "../../i18n";
import { useConfirm } from "../../ui/confirm-dialog";
import { useStartStrengthSession } from "../training/use-start-strength-session";
import { useTrainingData } from "../training/use-training-data";

type Sport = "strength" | "running" | "cycling" | "wod";
function useFlow() {
	const router = useRouter();
	const navigation = useNavigation();
	const confirm = useConfirm();
	const {
		t: { training: copy },
	} = useI18n();
	const data = useTrainingData();
	const starter = useStartStrengthSession(data);
	const [sport, setSport] = useState<Sport>("strength");
	const [routineId, setRoutineId] = useState<Id<"routines"> | null>(null);
	const [name, setName] = useState("");
	const [leaving, setLeaving] = useState(false);
	const afterLeave = useRef<(() => void) | null>(null);
	usePreventRemove(
		(Boolean(name.trim()) || starter.pending) && !leaving,
		({ data: event }) => {
			if (starter.pending) return;
			void confirm({
				title: copy.discardName,
				message: copy.discardNameMessage,
				confirmLabel: copy.discard,
				cancelLabel: copy.keepEditing,
				destructive: true,
			}).then((discard) => {
				if (discard) {
					afterLeave.current = () => navigation.dispatch(event.action);
					setLeaving(true);
				}
			});
		},
	);
	useEffect(() => {
		if (leaving && afterLeave.current) {
			const action = afterLeave.current;
			afterLeave.current = null;
			action();
		}
	}, [leaving]);
	function complete(href: Href) {
		afterLeave.current = () => router.dismissTo(href);
		setLeaving(true);
	}
	async function submit() {
		if (starter.pending) return;
		if (sport === "running" || sport === "cycling") {
			router.push("/start-activity/endurance");
			return;
		}
		if (sport === "wod") {
			router.push("/start-activity/wods");
			return;
		}
		const id = await starter.start(routineId ? { routineId } : { name });
		if (id) complete({ pathname: "/session", params: { id } });
	}
	return {
		data,
		pending: starter.pending,
		name,
		setName,
		sport,
		setSport,
		routineId,
		setRoutineId,
		submit,
		complete,
	};
}
const FlowContext = createContext<ReturnType<typeof useFlow> | null>(null);
export function StartActivityProvider({ children }: { children: ReactNode }) {
	const flow = useFlow();
	return <FlowContext.Provider value={flow}>{children}</FlowContext.Provider>;
}
export function useStartActivity() {
	const flow = useContext(FlowContext);
	if (!flow) throw new Error("Start activity requires its sheet provider.");
	return flow;
}
