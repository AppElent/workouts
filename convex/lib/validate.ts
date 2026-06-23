// Server-side input range guards. Mirrors the client-side Zod checks so that
// direct API calls can't write nonsensical data (negative weight, 10k-rep sets).

export function assertRange(
	value: number,
	min: number,
	max: number,
	label: string,
): void {
	if (!Number.isFinite(value)) {
		throw new Error(`${label} must be a number.`)
	}
	if (value < min || value > max) {
		throw new Error(`${label} must be between ${min} and ${max}.`)
	}
}

export function assertOptionalRange(
	value: number | undefined,
	min: number,
	max: number,
	label: string,
): void {
	if (value === undefined) return
	assertRange(value, min, max, label)
}
