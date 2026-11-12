import { useLayoutEffect, useRef, useState } from "react";

/** Width of an element in CSS pixels, so charts draw at real size. */
function useWidth<T extends HTMLElement>() {
	const ref = useRef<T>(null);
	const [width, setWidth] = useState(0);
	useLayoutEffect(() => {
		const element = ref.current;
		if (!element) return;
		const observer = new ResizeObserver(([entry]) =>
			setWidth(Math.floor(entry.contentRect.width)),
		);
		observer.observe(element);
		setWidth(Math.floor(element.getBoundingClientRect().width));
		return () => observer.disconnect();
	}, []);
	return [ref, width] as const;
}

type Point = { label: string; value: number };

const HEIGHT = 160;
const PAD = { top: 12, right: 12, bottom: 22, left: 40 };

function scale(points: readonly Point[]) {
	const values = points.map((point) => point.value);
	const min = Math.min(...values);
	const max = Math.max(...values);
	const span = max - min || Math.max(Math.abs(max) * 0.1, 1);
	return { min: min - span * 0.1, max: max + span * 0.1 };
}

function Axis({
	width,
	min,
	max,
	format,
}: {
	width: number;
	min: number;
	max: number;
	format: (value: number) => string;
}) {
	const ticks = [min, (min + max) / 2, max];
	const plot = HEIGHT - PAD.top - PAD.bottom;
	return (
		<g className="axis">
			{ticks.map((tick) => {
				const y = PAD.top + plot - ((tick - min) / (max - min)) * plot;
				return (
					<g key={tick}>
						<line x1={PAD.left} x2={width - PAD.right} y1={y} y2={y} />
						<text x={PAD.left - 6} y={y} dy="0.32em" textAnchor="end">
							{format(tick)}
						</text>
					</g>
				);
			})}
		</g>
	);
}

export function LineChart({
	points,
	label,
	format,
}: {
	points: readonly Point[];
	label: string;
	format: (value: number) => string;
}) {
	const [ref, width] = useWidth<HTMLDivElement>();
	const plotWidth = Math.max(width - PAD.left - PAD.right, 1);
	const plotHeight = HEIGHT - PAD.top - PAD.bottom;
	const { min, max } = scale(points);
	const x = (index: number) =>
		PAD.left +
		(points.length === 1
			? plotWidth / 2
			: (index / (points.length - 1)) * plotWidth);
	const y = (value: number) =>
		PAD.top + plotHeight - ((value - min) / (max - min)) * plotHeight;
	const path = points
		.map((point, index) => `${index ? "L" : "M"}${x(index)},${y(point.value)}`)
		.join("");
	const first = points[0];
	const last = points.at(-1);
	return (
		<div ref={ref} className="chart">
			{width > 0 && (
				<svg width={width} height={HEIGHT} role="img" aria-label={label}>
					<Axis width={width} min={min} max={max} format={format} />
					<path className="line" d={path} />
					{points.map((point, index) => (
						<circle
							// biome-ignore lint/suspicious/noArrayIndexKey: a static series that never reorders; labels can repeat.
							key={`${point.label}-${index}`}
							className="dot"
							cx={x(index)}
							cy={y(point.value)}
							r={3}
						>
							<title>{`${point.label}: ${format(point.value)}`}</title>
						</circle>
					))}
					{first && (
						<text className="tick" x={x(0)} y={HEIGHT - 6} textAnchor="start">
							{first.label}
						</text>
					)}
					{last && points.length > 1 && (
						<text
							className="tick"
							x={x(points.length - 1)}
							y={HEIGHT - 6}
							textAnchor="end"
						>
							{last.label}
						</text>
					)}
				</svg>
			)}
		</div>
	);
}

export function BarChart({
	points,
	label,
	format,
}: {
	points: readonly Point[];
	label: string;
	format: (value: number) => string;
}) {
	const [ref, width] = useWidth<HTMLDivElement>();
	const plotWidth = Math.max(width - PAD.left - PAD.right, 1);
	const plotHeight = HEIGHT - PAD.top - PAD.bottom;
	const max = Math.max(...points.map((point) => point.value), 1) * 1.1;
	const slot = plotWidth / Math.max(points.length, 1);
	const bar = Math.max(Math.min(slot * 0.7, 28), 2);
	return (
		<div ref={ref} className="chart">
			{width > 0 && (
				<svg width={width} height={HEIGHT} role="img" aria-label={label}>
					<Axis width={width} min={0} max={max} format={format} />
					{points.map((point, index) => {
						const height = (point.value / max) * plotHeight;
						return (
							<rect
								key={point.label}
								className="bar-mark"
								x={PAD.left + index * slot + (slot - bar) / 2}
								y={PAD.top + plotHeight - height}
								width={bar}
								height={height}
								rx={2}
							>
								<title>{`${point.label}: ${format(point.value)}`}</title>
							</rect>
						);
					})}
					{points[0] && (
						<text
							className="tick"
							x={PAD.left}
							y={HEIGHT - 6}
							textAnchor="start"
						>
							{points[0].label}
						</text>
					)}
					{points.length > 1 && (
						<text
							className="tick"
							x={width - PAD.right}
							y={HEIGHT - 6}
							textAnchor="end"
						>
							{points.at(-1)?.label}
						</text>
					)}
				</svg>
			)}
		</div>
	);
}
