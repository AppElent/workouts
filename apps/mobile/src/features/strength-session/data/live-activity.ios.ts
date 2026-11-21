/**
 * The strength session's Live Activity on iOS. One activity at a time, owned
 * by one session (its start time). The owner's activity id and session are
 * kept on the phone, so a relaunch during the same session takes the running
 * activity over instead of ending and restarting it. Any other activity, such
 * as one left from a session finished on another device, is ended and
 * replaced. When the user turned Live Activities off, `start` throws and the
 * session carries on without one.
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
import {
	DEVICE_KEYS,
	readLocalJson,
	removeLocal,
	writeLocalJson,
} from "../../../local-store/local-store";
import { reportError } from "../../../observability/errors";
import { sessionLiveActivityLayout } from "./live-activity-layout";
import { contentKey, type LiveActivityProps } from "./live-activity-props";

type Activity = LiveActivity<LiveActivityProps>;

const NAME = "StrengthSession";
let factory: LiveActivityFactory<LiveActivityProps> | null = null;
let currentId: string | null = null;
/** The `startedAt` of the session the current activity shows. */
let currentSession: number | null = null;
let sentKey = "";
/** Whether the owner kept by an earlier launch has been read back. */
let restored = false;

type Owner = { activityId: string; startedAt: number };

function parseOwner(value: unknown): Owner {
	const { activityId, startedAt } = (value ?? {}) as Partial<Owner>;
	if (typeof activityId !== "string" || typeof startedAt !== "number")
		throw new Error("Unexpected Live Activity owner");
	return { activityId, startedAt };
}

/**
 * On the first change after a launch, takes over the owner an earlier launch
 * kept. Its content is unknown (`sentKey` stays empty), so the first show
 * updates it.
 */
function restore() {
	if (restored) return;
	restored = true;
	const read = readLocalJson(DEVICE_KEYS.liveActivity, parseOwner);
	if (!read.ok || !read.value) return;
	currentId = read.value.activityId;
	currentSession = read.value.startedAt;
}

/** Set once creating the factory threw: reported then, skipped after. */
let factoryFailed = false;

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

function forget() {
	currentId = null;
	currentSession = null;
	sentKey = "";
	removeLocal(DEVICE_KEYS.liveActivity);
}

/** Brings the system's activities in line with `props`; null ends them all. */
async function sync(props: LiveActivityProps | null) {
	if (factoryFailed) return;
	try {
		restore();
		const instances = getFactory().getInstances();
		const owned =
			props && currentSession === props.startedAt
				? instances.find((item) => item.getId() === currentId)
				: undefined;
		// Never this session's: ended right away, also from the background.
		const extras = instances.filter((item) => item !== owned);
		if (extras.length) await Promise.all(extras.map(end));
		if (!props) {
			forget();
			return;
		}
		// iOS starts activities only from the foreground; becoming active
		// retries.
		if (!owned && AppState.currentState !== "active") return;
		const key = contentKey(props);
		if (!owned) {
			currentId = getFactory()
				.start(props, undefined, staleDateOf(props))
				.getId();
			currentSession = props.startedAt;
			sentKey = key;
			writeLocalJson(DEVICE_KEYS.liveActivity, {
				activityId: currentId,
				startedAt: currentSession,
			} satisfies Owner);
			return;
		}
		if (key === sentKey) return;
		await owned.update(props, staleDateOf(props));
		sentKey = key;
	} catch (error) {
		forget();
		// Without a factory every later change would fail the same way.
		if (!factory) factoryFailed = true;
		if (!isUnsupported(error) && !isGone(error))
			reportError(error, "live-activity.show");
	}
}

/** Undefined: nothing waiting. */
let wanted: LiveActivityProps | null | undefined;
/** An end asked for since the last drain; a later show must not replace it. */
let endWanted = false;
let draining = false;
async function drain() {
	draining = true;
	while (endWanted || wanted !== undefined) {
		if (endWanted) {
			endWanted = false;
			await sync(null);
			continue;
		}
		const next = wanted;
		wanted = undefined;
		if (next !== undefined) await sync(next);
	}
	draining = false;
}
function request(next: LiveActivityProps | null) {
	if (next === null) endWanted = true;
	wanted = next ?? undefined;
	if (!draining) void drain();
}

export function showSessionActivity(props: LiveActivityProps): void {
	request(props);
}

export function endSessionActivity(): void {
	request(null);
}
