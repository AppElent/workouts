import { Stack } from "expo-router";
import type { RefObject } from "react";
import type { SearchBarCommands } from "react-native-screens";
import type { LogFoodMenuProps } from "./log-food-menu-props";

/**
 * iOS 26+: search and its companion actions in the system bottom toolbar.
 *
 * The system owns the glass, follows the keyboard and expands the field above
 * it; nothing here imitates that. The + carries the same four actions as the
 * in-content `LogFoodMenu` on other platforms.
 */
export function LogFoodToolbar({
	searchRef,
	placeholder,
	scanLabel,
	describeLabel,
	menu,
	onChangeQuery,
	onSubmit,
	onScan,
	onDescribe,
}: {
	searchRef: RefObject<SearchBarCommands | null>;
	placeholder: string;
	scanLabel: string;
	describeLabel: string;
	/** Absent in a target mode, where only finding a food makes sense. */
	menu?: LogFoodMenuProps;
	onChangeQuery: (query: string) => void;
	onSubmit: () => void;
	onScan: () => void;
	onDescribe?: () => void;
}) {
	return (
		<>
			<Stack.SearchBar
				ref={searchRef}
				placeholder={placeholder}
				hideWhenScrolling={false}
				// Keep "Lunch ⌄" visible while typing (design: Typen).
				hideNavigationBar={false}
				autoCapitalize="none"
				onChangeText={(event) => onChangeQuery(event.nativeEvent.text)}
				onSearchButtonPress={onSubmit}
			/>
			<Stack.Toolbar placement="bottom">
				{menu ? (
					<Stack.Toolbar.Menu icon="plus" accessibilityLabel={menu.label}>
						<Stack.Toolbar.MenuAction icon="timer" onPress={menu.onLogOnce}>
							{menu.logOnceLabel}
						</Stack.Toolbar.MenuAction>
						<Stack.Toolbar.Menu inline>
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
						</Stack.Toolbar.Menu>
						{menu.canSaveAsNote ? (
							<Stack.Toolbar.MenuAction
								icon="note.text"
								onPress={menu.onSaveAsNote}
							>
								{menu.saveAsNoteLabel}
							</Stack.Toolbar.MenuAction>
						) : null}
					</Stack.Toolbar.Menu>
				) : null}
				<Stack.Toolbar.SearchBarSlot />
				{/* The title is what VoiceOver reads; `accessibilityLabel` alone was
				    not applied to bottom toolbar items (it read the symbol name). */}
				<Stack.Toolbar.Button
					icon="barcode.viewfinder"
					accessibilityLabel={scanLabel}
					onPress={onScan}
				>
					{scanLabel}
				</Stack.Toolbar.Button>
				{onDescribe ? (
					<Stack.Toolbar.Button
						icon="sparkles"
						accessibilityLabel={describeLabel}
						onPress={onDescribe}
					>
						{describeLabel}
					</Stack.Toolbar.Button>
				) : null}
			</Stack.Toolbar>
		</>
	);
}
