/**
 * Fold the accented letters that occur in Dutch and English food names.
 *
 * Deliberately a table rather than `normalize("NFD")`: this runs on Hermes,
 * whose Unicode surface varies by build, and the alternative is a silent
 * behaviour difference between the test run and the phone.
 */
const FOLD: Record<string, string> = {
	à: "a",
	á: "a",
	â: "a",
	ã: "a",
	ä: "a",
	å: "a",
	æ: "ae",
	ç: "c",
	è: "e",
	é: "e",
	ê: "e",
	ë: "e",
	ì: "i",
	í: "i",
	î: "i",
	ï: "i",
	ñ: "n",
	ò: "o",
	ó: "o",
	ô: "o",
	õ: "o",
	ö: "o",
	ø: "o",
	ù: "u",
	ú: "u",
	û: "u",
	ü: "u",
	ý: "y",
	ÿ: "y",
	ß: "ss",
};

/** Lowercase, fold accents, and reduce punctuation to single spaces. */
export function normaliseForSearch(text: string): string {
	let out = "";
	for (const character of text.toLowerCase()) {
		const folded = FOLD[character];
		if (folded !== undefined) out += folded;
		else if (
			(character >= "a" && character <= "z") ||
			(character >= "0" && character <= "9")
		)
			out += character;
		else out += " ";
	}
	return out.trim().replace(/\s+/g, " ");
}
