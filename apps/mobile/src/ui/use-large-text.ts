import { useWindowDimensions } from "react-native";

/** At accessibility text sizes a row takes two lines instead of dropping content. */
export const useLargeText = () => useWindowDimensions().fontScale >= 1.35;
