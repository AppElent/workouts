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
import { reportError } from "../../../observability/errors";
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

/** Updates and ends run one at a time, so a later change never lands first. */
let queue: Promise<unknown> = Promise.resolve();
const enqueue = (task: () => Promise<unknown>) => {
	queue = queue.then(task).catch(ignore);
};

/** Off in Settings, or no Live Activities on this device: carry on without one. */
const isUnsupported = (error: unknown) =>
	(error as { code?: string } | null)?.code ===
	"ERR_LIVE_ACTIVITIES_NOT_SUPPORTED";

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
				enqueue(() => extra.end("immediate"));
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
		enqueue(() =>
			keep.update(props, staleDateOf(props)).catch(() => {
				// Gone underneath us (the user dismissed it): start fresh next time.
				if (current?.getId() === id) current = null;
				sentKey = "";
			}),
		);
	} catch (error) {
		current = null;
		sentKey = "";
		if (!isUnsupported(error)) reportError(error, "live-activity.show");
	}
}

export function endSessionActivity(): void {
	current = null;
	sentKey = "";
	try {
		for (const instance of getFactory().getInstances())
			enqueue(() => instance.end("immediate"));
	} catch (error) {
		if (!isUnsupported(error)) reportError(error, "live-activity.end");
	}
}
