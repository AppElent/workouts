/**
 * The strength session's Live Activity: lock screen banner and Dynamic Island.
 *
 * The `'widget'` directive compiles this function to a string that the widget
 * extension evaluates with `@expo/ui/swift-ui` as globals. It cannot close
 * over anything in this module: copy and colours arrive formatted in props
 * (see `live-activity-props.ts`). Both clocks are system timer texts, so they
 * keep counting while the app is suspended. At the rest's end a timer mask
 * swaps the countdown for "Rest over" without an update (`atRestEnd`);
 * `isStale` (the app passes the rest's end as the stale date) and `restOver`
 * (the app saw the rest run out) keep it there.
 */
import {
	HStack,
	Image,
	Mask,
	ProgressView,
	Spacer,
	Text,
	VStack,
	ZStack,
} from "@expo/ui/swift-ui";
import {
	activityBackgroundTint,
	background,
	contrast,
	font,
	foregroundStyle,
	frame,
	labelsHidden,
	lineLimit,
	luminanceToAlpha,
	minimumScaleFactor,
	monospacedDigit,
	multilineTextAlignment,
	padding,
	scaleEffect,
	tint,
} from "@expo/ui/swift-ui/modifiers";
import type { LiveActivityComponent } from "expo-widgets";
import type { ReactNode } from "react";
import type { LiveActivityProps } from "./live-activity-props";

export const sessionLiveActivityLayout: LiveActivityComponent<
	LiveActivityProps
> = (props, environment) => {
	"widget";
	const scheme = props.colors;
	// The app says so while it runs; `atRestEnd` and the stale date say so while
	// it is suspended.
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

	// iOS applies the stale date no sooner than about 2 minutes after the last
	// update, so a short rest would sit at 0:00 (APP-917). A timer progress bar
	// over the rest's last 50 ms is empty before the end and full after it;
	// pushed to black and white and stretched over the slot, it is a mask that
	// flips at the end on its own.
	const restEndsAt = props.restEndsAt;
	const gate = (afterEnd: boolean) =>
		restEndsAt === null ? null : (
			<ProgressView
				timerInterval={{
					lower: new Date(restEndsAt - 50),
					upper: new Date(restEndsAt),
				}}
				countsDown={!afterEnd}
				modifiers={[
					labelsHidden(),
					tint("#FFFFFF"),
					foregroundStyle("#000000"),
					background("#000000"),
					// The grey track goes clear, the white fill opaque.
					contrast(100),
					luminanceToAlpha(),
					scaleEffect({ x: 1.5, y: 40 }),
				]}
			/>
		);
	const atRestEnd = (
		during: ReactNode,
		after: ReactNode,
		alignment: "leading" | "center" | "trailing",
	) => (
		<ZStack alignment={alignment}>
			<Mask>
				{during}
				<Mask.Content>{gate(false)}</Mask.Content>
			</Mask>
			<Mask>
				{after}
				<Mask.Content>{gate(true)}</Mask.Content>
			</Mask>
		</ZStack>
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
	const body = (colors: typeof scheme) => {
		const restOverLine = (
			<Text
				modifiers={[
					font({ size: 28, weight: "bold" }),
					foregroundStyle(colors.accent),
				]}
			>
				{props.labels.restOver}
			</Text>
		);
		return (
			<VStack alignment="leading" spacing={2}>
				{resting
					? atRestEnd(
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
							</HStack>,
							restOverLine,
							"leading",
						)
					: restOver
						? restOverLine
						: null}
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
	};

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
					? atRestEnd(
							countdown(scheme.accent, 15, "trailing"),
							compactRestOver,
							"trailing",
						)
					: restOver
						? compactRestOver
						: elapsed(scheme.text, 15, 52)}
			</HStack>
		),
		minimal: resting
			? atRestEnd(
					countdown(scheme.accent, 13, "center"),
					icon(scheme.accent),
					"center",
				)
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
