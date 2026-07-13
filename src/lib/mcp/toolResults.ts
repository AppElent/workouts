export function jsonText(value: unknown) {
	return {
		content: [
			{
				type: "text" as const,
				text: JSON.stringify(value, null, 2),
			},
		],
	};
}

export function errorText(message: string) {
	return {
		isError: true,
		content: [
			{
				type: "text" as const,
				text: message,
			},
		],
	};
}
