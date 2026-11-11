export function AuthError({ message }: { message: string | null }) {
	if (!message) return null;
	return (
		<p
			role="alert"
			className="rounded-[var(--auth-radius)] bg-[var(--auth-error)]/10 px-3 py-2 text-sm text-[var(--auth-error)]"
		>
			{message}
		</p>
	);
}
