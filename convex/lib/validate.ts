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

export function assertIntegerRange(value: number, min: number, max: number, label: string): void {
 assertRange(value, min, max, label)
 if (!Number.isInteger(value)) throw new Error(`${label} must be a whole number.`)
}

export function assertOptionalRpe(value: number | undefined): void {
 assertOptionalRange(value, 1, 10, 'RPE')
 if (value !== undefined && !Number.isInteger(value * 2)) throw new Error('RPE must use whole or half steps.')
}
