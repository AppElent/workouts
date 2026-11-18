/**
 * The strength session's Live Activity on iOS. One activity at a time: a
 * running one (from before a restart) is adopted, extras are ended. When the
 * user turned Live Activities off, `start` throws and the session carries on
 * without one.
 */
import {
	createLiveActivity,
	type LiveActivity,
	type LiveActivityFactory,
} from "expo-widgets";
import { sessionLiveActivityLayout } from "./live-activity-layout";
import { contentKey, type LiveActivityProps } from "./live-activity-props";

const NAME = "StrengthSession";
let factory: LiveActivityFactory<LiveActivityProps> | null = null;
let current: LiveActivity<LiveActivityProps> | null = null;
let sentKey = "";

// Created on first use: creating it writes the layout to the app group.
function getFactory() {
	factory ??= createLiveActivity(NAME, sessionLiveActivityLayout);
	return factory;
}
const ignore = () => undefined;

/** The rest's end makes the content stale, which the layout reads as "Rest over". */
const staleDateOf = (props: LiveActivityProps) =>
	props.restEndsAt === null ? undefined : new Date(props.restEndsAt);

export function showSessionActivity(props: LiveActivityProps): void {
	try {
		const instances = getFactory().getInstances();
		const keep =
			instances.find((item) => item.getId() === current?.getId()) ??
			instances[0];
		for (const extra of instances)
			if (extra.getId() !== keep?.getId())
				void extra.end("immediate").catch(ignore);
		const key = contentKey(props);
		if (!keep) {
			current = getFactory().start(props, undefined, staleDateOf(props));
			sentKey = key;
			return;
		}
		if (keep.getId() !== current?.getId()) sentKey = "";
		current = keep;
		if (key === sentKey) return;
		sentKey = key;
		const id = keep.getId();
		void keep.update(props, staleDateOf(props)).catch(() => {
			// Gone underneath us (the user dismissed it): start fresh next time.
			if (current?.getId() === id) current = null;
			sentKey = "";
		});
	} catch {
		// Live Activities are off, or not supported on this device.
		current = null;
		sentKey = "";
	}
}

export function endSessionActivity(): void {
	current = null;
	sentKey = "";
	try {
		for (const instance of getFactory().getInstances())
			void instance.end("immediate").catch(ignore);
	} catch {
		// Nothing to end.
	}
}
