import { createContext, type ReactNode, use, useState } from "react";

const TabBarVisibility = createContext<{
	hidden: boolean;
	setHidden: (hidden: boolean) => void;
}>({ hidden: false, setHidden: () => {} });
export function TabBarVisibilityProvider({
	children,
}: {
	children: ReactNode;
}) {
	const [hidden, setHidden] = useState(false);
	return (
		<TabBarVisibility value={{ hidden, setHidden }}>
			{children}
		</TabBarVisibility>
	);
}
export function useTabBarVisibility() {
	return use(TabBarVisibility);
}
