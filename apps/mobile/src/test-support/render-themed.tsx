import { type RenderOptions, render } from "@testing-library/react-native";
import type { ReactElement, ReactNode } from "react";
import { AppearanceProvider } from "../theme";

/** Mount isolated UI with the same appearance boundary as the actual app. */
export async function renderThemed(
	component: ReactElement,
	options?: RenderOptions,
) {
	const Wrapper = options?.wrapper;
	return await render(component, {
		...options,
		wrapper: ({ children }: { children: ReactNode }) => (
			<AppearanceProvider>
				{Wrapper ? <Wrapper>{children}</Wrapper> : children}
			</AppearanceProvider>
		),
	});
}
