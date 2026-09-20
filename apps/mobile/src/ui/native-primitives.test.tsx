import { fireEvent, render, screen } from "@testing-library/react-native";
import { BucketChart, TrendChart } from "./chart";
import { EmptyState } from "./empty-state";
import { ProgressRing } from "./progress-ring";
import { Segmented } from "./segmented";
import { SkeletonCard, SkeletonList } from "./skeleton";

// jest-expo resolves to the `.ios.tsx` files, against the `@expo/ui` mock.
// Steps 2.3–2.5 of docs/design/foundry-native-plan.md.

describe("Segmented → system Picker", () => {
	it("marks the selected option and reports a change by value", () => {
		const onChange = jest.fn();
		render(
			<Segmented
				value="nl"
				onChange={onChange}
				options={[
					{ value: "en", label: "English" },
					{ value: "nl", label: "Nederlands", accessibilityLabel: "Dutch" },
				]}
			/>,
		);
		expect(screen.getByLabelText("Dutch").props.accessibilityState).toEqual({
			selected: true,
		});
		fireEvent.press(screen.getByLabelText("English"));
		expect(onChange).toHaveBeenCalledWith("en");
	});
});

describe("EmptyState", () => {
	it("uses the system ContentUnavailableView for the search appearance", () => {
		render(
			<EmptyState
				appearance="search"
				title="Nothing matches"
				body="Try clearing a filter or two."
			/>,
		);
		const view = screen.getByTestId("swiftui-content-unavailable");
		expect(view.props.systemImage).toBe("magnifyingglass");
		expect(screen.getByText("Try clearing a filter or two.")).toBeTruthy();
	});

	it("keeps the inline appearance in React Native, with its action", () => {
		const add = jest.fn();
		render(
			<EmptyState
				body="A routine is a template."
				action={{ label: "New routine", onPress: add }}
			/>,
		);
		expect(screen.queryByTestId("swiftui-content-unavailable")).toBeNull();
		fireEvent.press(screen.getByText("New routine"));
		expect(add).toHaveBeenCalled();
	});
});

describe("Charts → Swift Charts", () => {
	it("says so under two points instead of drawing a trend", () => {
		render(<TrendChart title="1RM" points={[{ value: 100 }]} />);
		expect(screen.getByText("Not enough data yet.")).toBeTruthy();
		expect(screen.queryByTestId("swiftui-chart-line")).toBeNull();
	});

	it("draws a line for a trend and bars for buckets, keyed by label", () => {
		render(
			<>
				<TrendChart
					title="1RM"
					points={[
						{ value: 100, label: "Aug" },
						{ value: 105, label: "Sep" },
					]}
				/>
				<BucketChart title="Volume" points={[{ value: 12, label: "Mon" }]} />
			</>,
		);
		expect(screen.getByTestId("swiftui-chart-line").props.data).toEqual([
			{ x: "Aug", y: 100 },
			{ x: "Sep", y: 105 },
		]);
		expect(screen.getByTestId("swiftui-chart-bar").props.data[0]).toMatchObject(
			{ x: "Mon", y: 12 },
		);
	});
});

describe("ProgressRing → Gauge", () => {
	it("is a bounded, spoken progress indicator with the count in the hole", () => {
		render(
			<ProgressRing
				value={3}
				max={5}
				caption="this wk"
				accessibilityLabel="3 of 5 sessions this week"
			/>,
		);
		const gauge = screen.getByLabelText("3 of 5 sessions this week");
		expect(gauge.props.accessibilityValue).toEqual({ now: 3, max: 5 });
		expect(screen.getByText("3")).toBeTruthy();
		expect(screen.getByText("this wk")).toBeTruthy();
	});

	it("never overflows the bound", () => {
		render(<ProgressRing value={9} max={5} accessibilityLabel="over" />);
		expect(screen.getByLabelText("over").props.accessibilityValue.now).toBe(5);
	});
});

describe("Skeletons", () => {
	it("render the requested shapes without any text", () => {
		render(
			<>
				<SkeletonList rows={4} />
				<SkeletonCard lines={3} />
			</>,
		);
		expect(screen.queryByText(/./)).toBeNull();
	});
});
