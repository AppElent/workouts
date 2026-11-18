/**
 * The strength session's Live Activity on iOS. One activity at a time: a
 * running one (from before a restart) is adopted, extras are ended. When the
 * user turned Live Activities off, `start` throws and the session carries on
 * without one.
 *
 * Every change runs one at a time against the latest wanted state, so an end
 * finishes before a new activity starts and a later change never lands first.
 */
import {
	createLiveActivity,
	type LiveActivity,
	type LiveActivityFactory,
} from "expo-widgets";
import { AppState } from "react-native";
import { reportError } from "../../../observability/errors";
import { sessionLiveActivityLayout } from "./live-activity-layout";
import { contentKey, type LiveActivityProps } from "./live-activity-props";

type Activity = LiveActivity<LiveActivityProps>;

const NAME = "StrengthSession";
let factory: LiveActivityFactory<LiveActivityProps> | null = null;
let currentId: string | null = null;
let sentKey = "";

// Created on first use: creating it writes the layout to the app group.
function getFactory() {
	factory ??= createLiveActivity(NAME, sessionLiveActivityLayout);
	return factory;
}

const codeOf = (error: unknown) => (error as { code?: string } | null)?.code;
/** Off in Settings, or no Live Activities on this device: carry on without one. */
const isUnsupported = (error: unknown) =>
	codeOf(error) === "ERR_LIVE_ACTIVITIES_NOT_SUPPORTED";
/** Ended underneath us, for example dismissed by the user. */
const isGone = (error: unknown) =>
	codeOf(error) === "ERR_LIVE_ACTIVITY_NOT_FOUND";

/** The rest's end makes the content stale, which the layout reads as "Rest over". */
const staleDateOf = (props: LiveActivityProps) =>
	props.restEndsAt === null ? undefined : new Date(props.restEndsAt);

async function end(activity: Activity) {
	try {
		await activity.end("immediate");
	} catch (error) {
		if (!isGone(error)) reportError(error, "live-activity.end");
	}
}

/** Brings the system's activities in line with `props`; null ends them all. */
async function sync(props: LiveActivityProps | null) {
	try {
		const instances = getFactory().getInstances();
		const keep = props
			? (instances.find((item) => item.getId() === currentId) ?? instances[0])
			: undefined;
		const extras = instances.filter((item) => item !== keep);
		if (extras.length) await Promise.all(extras.map(end));
		if (!props) {
			currentId = null;
			sentKey = "";
			return;
		}
		const key = contentKey(props);
		if (!keep) {
			// iOS starts activities only from the foreground; becoming active retries.
			const state = AppState.currentState;
			if (state === "background" || state === "inactive") return;
			currentId = getFactory()
				.start(props, undefined, staleDateOf(props))
				.getId();
			sentKey = key;
			return;
		}
		if (keep.getId() !== currentId) sentKey = "";
		currentId = keep.getId();
		if (key === sentKey) return;
		await keep.update(props, staleDateOf(props));
		sentKey = key;
	} catch (error) {
		currentId = null;
		sentKey = "";
		if (!isUnsupported(error) && !isGone(error))
			reportError(error, "live-activity.show");
	}
}

/** Undefined: nothing waiting. */
let wanted: LiveActivityProps | null | undefined;
let draining = false;
async function drain() {
	draining = true;
	while (wanted !== undefined) {
		const next = wanted;
		wanted = undefined;
		await sync(next);
	}
	draining = false;
}
function request(next: LiveActivityProps | null) {
	wanted = next;
	if (!draining) void drain();
}

export function showSessionActivity(props: LiveActivityProps): void {
	request(props);
}

export function endSessionActivity(): void {
	request(null);
}
