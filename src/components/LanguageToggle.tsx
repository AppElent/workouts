import { fmt, useI18n } from "#/lib/i18n";

const LOCALE_NAMES = { en: "English", nl: "Nederlands" } as const;

export function LanguageToggle() {
	const { locale, messages, setLocale } = useI18n();
	const next = locale === "en" ? "nl" : "en";
	const label = fmt(messages.common.header.switchLanguage, {
		language: LOCALE_NAMES[next],
	});

	return (
		<button
			type="button"
			onClick={() => setLocale(next)}
			aria-label={label}
			title={label}
			className="flex items-center justify-center gap-1 px-3 py-2 text-xs font-bold text-[var(--text-muted)] hover:text-white transition-colors"
		>
			{locale.toUpperCase()}
		</button>
	);
}
