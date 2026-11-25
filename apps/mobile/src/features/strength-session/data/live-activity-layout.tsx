/**
 * The strength session's Live Activity: lock screen banner and Dynamic Island.
 *
 * The `'widget'` directive compiles this function to a string that the widget
 * extension evaluates with `@expo/ui/swift-ui` as globals. It cannot close
 * over anything in this module: copy and colours arrive formatted in props
 * (see `live-activity-props.ts`). Both clocks are system timer texts, so they
 * keep counting while the app is suspended; `isStale` turns true at the end of
 * the rest (the app passes it as the stale date) and swaps in "Rest over";
 * `restOver` keeps it there once the app has seen the rest run out.
 */
import { HStack, Image, Spacer, Text, VStack } from "@expo/ui/swift-ui";
import {
	activityBackgroundTint,
	font,
	foregroundStyle,
	frame,
	lineLimit,
	minimumScaleFactor,
	monospacedDigit,
	multilineTextAlignment,
	padding,
} from "@expo/ui/swift-ui/modifiers";
import type { LiveActivityComponent } from "expo-widgets";
import type { LiveActivityProps } from "./live-activity-props";

export const sessionLiveActivityLayout: LiveActivityComponent<
	LiveActivityProps
> = (props, environment) => {
	"widget";
	const scheme = props.colors;
	// The app says so while it runs; the stale date says so while it is suspended.
	const resting = props.restEndsAt !== null && !environment.isStale;
	const restOver =
		props.restOver ||
		(props.restEndsAt !== null && environment.isStale === true);
	const elapsedFrom = new Date(props.startedAt);
	const restRange =
		props.restEndsAt !== null
			? {
					lower: new Date(Math.min(props.restFrom, props.restEndsAt)),
					upper: new Date(props.restEndsAt),
				}
			: null;
	const detail = [props.setLine, props.loadLine].filter(Boolean).join(" · ");

	// Timer text takes all the width it is offered, so pin it to the trailing edge.
	const elapsed = (color: string, size: number, width = 72) => (
		<Text
			date={elapsedFrom}
			dateStyle="timer"
			modifiers={[
				font({ size, weight: "semibold" }),
				monospacedDigit(),
				foregroundStyle(color),
				multilineTextAlignment("trailing"),
				// Past an hour "1:02:03" shrinks to fit instead of being cut off.
				lineLimit(1),
				minimumScaleFactor(0.75),
				frame({ width, alignment: "trailing" }),
			]}
		/>
	);
	// Sized to fit "10:00" at this size, so the label beside it stays close.
	const countdown = (
		color: string,
		size: number,
		alignment: "leading" | "center" | "trailing" = "leading",
	) =>
		restRange ? (
			<Text
				timerInterval={restRange}
				countsDown
				modifiers={[
					font({ size, weight: "bold" }),
					monospacedDigit(),
					foregroundStyle(color),
					frame({ width: size * 2.9, alignment }),
				]}
			/>
		) : null;
	const icon = (color: string) => (
		<Image systemName="dumbbell.fill" color={color} />
	);

	// Two short lines fit the slot beside the camera, also as "Rust voorbij".
	const compactRestOver = (
		<Text
			modifiers={[
				font({ size: 12, weight: "bold" }),
				foregroundStyle(scheme.accent),
				multilineTextAlignment("trailing"),
				lineLimit(2),
				minimumScaleFactor(0.75),
				// Clear of the rounded end, which cuts off the "j".
				padding({ trailing: 4 }),
			]}
		>
			{props.labels.restOver}
		</Text>
	);

	/** Exercise, then set and load; under the countdown while resting. */
	const body = (colors: typeof scheme) => (
		<VStack alignment="leading" spacing={2}>
			{resting ? (
				<HStack spacing={8} alignment="firstTextBaseline">
					{countdown(colors.accent, 34)}
					<Text
						modifiers={[
							font({ textStyle: "subheadline" }),
							foregroundStyle(colors.muted),
						]}
					>
						{props.labels.rest}
					</Text>
				</HStack>
			) : restOver ? (
				<Text
					modifiers={[
						font({ size: 28, weight: "bold" }),
						foregroundStyle(colors.accent),
					]}
				>
					{props.labels.restOver}
				</Text>
			) : null}
			{props.exercise ? (
				<Text
					modifiers={[
						font(
							resting || restOver
								? { textStyle: "subheadline", weight: "semibold" }
								: { size: 22, weight: "bold" },
						),
						foregroundStyle(colors.text),
						lineLimit(1),
					]}
				>
					{resting || restOver
						? `${props.labels.next} · ${props.exercise}`
						: props.exercise}
				</Text>
			) : null}
			{detail ? (
				<Text
					modifiers={[
						font({ textStyle: "subheadline" }),
						monospacedDigit(),
						foregroundStyle(colors.muted),
						lineLimit(1),
					]}
				>
					{detail}
				</Text>
			) : null}
		</VStack>
	);

	return {
		banner: (
			<VStack
				alignment="leading"
				spacing={8}
				modifiers={[
					// Full width, so the header's Spacer pushes the clock right.
					frame({ maxWidth: 10_000, alignment: "leading" }),
					padding({ all: 16 }),
					activityBackgroundTint(scheme.bg),
				]}
			>
				<HStack spacing={6}>
					{icon(scheme.accent)}
					<Text
						modifiers={[
							font({ textStyle: "footnote", weight: "semibold" }),
							foregroundStyle(scheme.muted),
							lineLimit(1),
						]}
					>
						{props.title}
					</Text>
					<Spacer />
					{elapsed(scheme.muted, 15)}
				</HStack>
				{body(scheme)}
			</VStack>
		),
		compactLeading: (
			<HStack spacing={4}>
				{icon(scheme.accent)}
				{props.exercise ? (
					<Text
						modifiers={[
							font({ textStyle: "caption", weight: "semibold" }),
							foregroundStyle(scheme.text),
							lineLimit(1),
							frame({ maxWidth: 80, alignment: "leading" }),
						]}
					>
						{props.exercise}
					</Text>
				) : null}
			</HStack>
		),
		compactTrailing: (
			<HStack modifiers={[frame({ width: 52, alignment: "trailing" })]}>
				{resting
					? countdown(scheme.accent, 15, "trailing")
					: restOver
						? compactRestOver
						: elapsed(scheme.text, 15, 52)}
			</HStack>
		),
		minimal: resting
			? countdown(scheme.accent, 13, "center")
			: icon(scheme.accent),
		expandedLeading: (
			<HStack spacing={6} modifiers={[padding({ leading: 4 })]}>
				{icon(scheme.accent)}
				<Text
					modifiers={[
						font({ textStyle: "footnote", weight: "semibold" }),
						foregroundStyle(scheme.muted),
						lineLimit(1),
					]}
				>
					{props.title}
				</Text>
			</HStack>
		),
		expandedTrailing: (
			<HStack modifiers={[padding({ trailing: 4 })]}>
				{elapsed(scheme.muted, 15)}
			</HStack>
		),
		expandedBottom: (
			<HStack modifiers={[padding({ horizontal: 4, bottom: 4 })]}>
				{body(scheme)}
				<Spacer />
			</HStack>
		),
	};
};
