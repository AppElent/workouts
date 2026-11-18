/**
 * The strength session's Live Activity: lock screen banner and Dynamic Island.
 *
 * The `'widget'` directive compiles this function to a string that the widget
 * extension evaluates with `@expo/ui/swift-ui` as globals. It cannot close
 * over anything in this module: copy and colours arrive formatted in props
 * (see `live-activity-props.ts`). Both clocks are system timer texts, so they
 * keep counting while the app is suspended; `isStale` turns true at the end of
 * the rest (the app passes it as the stale date) and swaps in "Rest over".
 */
import { HStack, Image, Spacer, Text, VStack } from "@expo/ui/swift-ui";
import {
	font,
	foregroundStyle,
	frame,
	lineLimit,
	monospacedDigit,
	padding,
} from "@expo/ui/swift-ui/modifiers";
import type { LiveActivityComponent } from "expo-widgets";
import type { LiveActivityProps } from "./live-activity-props";

export const sessionLiveActivityLayout: LiveActivityComponent<
	LiveActivityProps
> = (props, environment) => {
	"widget";
	const scheme =
		environment.colorScheme === "dark" ? props.colors.dark : props.colors.light;
	const island = props.colors.dark;
	const resting = props.restEndsAt !== null && !environment.isStale;
	const restOver = props.restEndsAt !== null && environment.isStale === true;
	const elapsedFrom = new Date(props.startedAt);
	const restRange =
		props.restEndsAt !== null
			? {
					lower: new Date(Math.min(props.restFrom, props.restEndsAt)),
					upper: new Date(props.restEndsAt),
				}
			: null;
	const detail = [props.setLine, props.loadLine].filter(Boolean).join(" · ");

	const elapsed = (color: string, size: number) => (
		<Text
			date={elapsedFrom}
			dateStyle="timer"
			modifiers={[
				font({ size, weight: "semibold" }),
				monospacedDigit(),
				foregroundStyle(color),
			]}
		/>
	);
	const countdown = (color: string, size: number) =>
		restRange ? (
			<Text
				timerInterval={restRange}
				countsDown
				modifiers={[
					font({ size, weight: "bold" }),
					monospacedDigit(),
					foregroundStyle(color),
				]}
			/>
		) : null;
	const icon = (color: string) => (
		<Image systemName="dumbbell.fill" color={color} />
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
				modifiers={[padding({ all: 16 })]}
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
				{icon(island.accent)}
				{props.exercise ? (
					<Text
						modifiers={[
							font({ textStyle: "caption", weight: "semibold" }),
							foregroundStyle(island.text),
							lineLimit(1),
							frame({ maxWidth: 64, alignment: "leading" }),
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
					? countdown(island.accent, 15)
					: restOver
						? icon(island.accent)
						: elapsed(island.text, 15)}
			</HStack>
		),
		minimal: resting ? countdown(island.accent, 13) : icon(island.accent),
		expandedLeading: (
			<HStack spacing={6} modifiers={[padding({ leading: 4 })]}>
				{icon(island.accent)}
				<Text
					modifiers={[
						font({ textStyle: "footnote", weight: "semibold" }),
						foregroundStyle(island.muted),
						lineLimit(1),
					]}
				>
					{props.title}
				</Text>
			</HStack>
		),
		expandedTrailing: (
			<HStack modifiers={[padding({ trailing: 4 })]}>
				{elapsed(island.muted, 15)}
			</HStack>
		),
		expandedBottom: (
			<HStack modifiers={[padding({ horizontal: 4, bottom: 4 })]}>
				{body(island)}
				<Spacer />
			</HStack>
		),
	};
};
