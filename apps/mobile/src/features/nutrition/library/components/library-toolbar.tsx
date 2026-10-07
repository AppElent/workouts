import { Stack } from "expo-router";
import type { RefObject } from "react";
import type { SearchBarCommands } from "react-native-screens";

export type LibraryAddMenu = {
	label: string;
	newFoodLabel: string;
	newRecipeLabel: string;
	newComboLabel: string;
	onNewFood: () => void;
	onNewRecipe: () => void;
	onNewCombo: () => void;
};

/**
 * iOS 26+: search, + and scan in the system bottom toolbar, the same seam as
 * Log food. Earlier iOS and Android keep these in the content.
 */
export function LibraryToolbar({
	searchRef,
	placeholder,
	scanLabel,
	menu,
	onChangeQuery,
	onScan,
}: {
	searchRef: RefObject<SearchBarCommands | null>;
	placeholder: string;
	scanLabel: string;
	menu: LibraryAddMenu;
	onChangeQuery: (query: string) => void;
	onScan: () => void;
}) {
	return (
		<>
			<Stack.SearchBar
				ref={searchRef}
				placeholder={placeholder}
				hideWhenScrolling={false}
				hideNavigationBar={false}
				autoCapitalize="none"
				onChangeText={(event) => onChangeQuery(event.nativeEvent.text)}
			/>
			<Stack.Toolbar placement="bottom">
				<Stack.Toolbar.Menu icon="plus" accessibilityLabel={menu.label}>
					<Stack.Toolbar.MenuAction
						icon="square.and.pencil"
						onPress={menu.onNewFood}
					>
						{menu.newFoodLabel}
					</Stack.Toolbar.MenuAction>
					<Stack.Toolbar.MenuAction
						icon="text.book.closed"
						onPress={menu.onNewRecipe}
					>
						{menu.newRecipeLabel}
					</Stack.Toolbar.MenuAction>
					<Stack.Toolbar.MenuAction
						icon="square.stack.3d.up"
						onPress={menu.onNewCombo}
					>
						{menu.newComboLabel}
					</Stack.Toolbar.MenuAction>
				</Stack.Toolbar.Menu>
				<Stack.Toolbar.SearchBarSlot />
				<Stack.Toolbar.Button
					icon="barcode.viewfinder"
					accessibilityLabel={scanLabel}
					onPress={onScan}
				>
					{scanLabel}
				</Stack.Toolbar.Button>
			</Stack.Toolbar>
		</>
	);
}
