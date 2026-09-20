export interface ProgressRingProps {
	/** Completed count. */
	value: number;
	/** The bound; the ring is full at this. */
	max: number;
	/** Spoken: "3 of 5 sessions this week". */
	accessibilityLabel: string;
	/** Under the number, inside the ring. */
	caption?: string;
	/** 48 is the floor. */
	size?: number;
}
