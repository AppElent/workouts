import { SUPPORTED_LOCALES } from "@foundry/core";
import { fmt, useI18n } from "#/lib/i18n";

export function LanguageToggle() {
	const { locale, messages, setLocale } = useI18n();
	const next =
		SUPPORTED_LOCALES[
			(SUPPORTED_LOCALES.indexOf(locale) + 1) % SUPPORTED_LOCALES.length
		];
	const label = fmt(messages.common.header.switchLanguage, {
		language:
			new Intl.DisplayNames([next], { type: "language" }).of(next) ?? next,
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
