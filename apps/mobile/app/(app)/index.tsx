/**
 * PROTOTYPE — #46. The signed-in entry point, which under test is a fork
 * rather than a screen: it sends you to whichever variant's front door is
 * currently selected. Variant A starts selected, so a fresh launch lands on
 * `/a-home`.
 *
 * When a variant wins this file becomes that variant's home screen and the
 * redirect disappears.
 */
import { Redirect } from "expo-router";
import { useVariant, VARIANTS } from "../../src/prototype/shell-variant";

export default function Entry() {
	const variant = useVariant();
	const home = VARIANTS.find((v) => v.key === variant)?.home ?? "/a-home";
	return <Redirect href={home} />;
}
