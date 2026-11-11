import { useCallback } from "react";
import { ActionSheetIOS, Platform } from "react-native";
import { useConfirm } from "./confirm-dialog";

export type ActionChoice = { label: string; destructive?: boolean };
/** A native action sheet where there is one, a confirm dialog elsewhere. */
export function useChoice() {
	const confirm = useConfirm();
	return useCallback(
		async (input: {
			title: string;
			message?: string;
			confirm: ActionChoice;
			cancel: string;
			/** On iOS, adds a way out that does neither; choosing it or tapping away gives null. */
			dismiss?: string;
		}): Promise<boolean | null> => {
			if (Platform.OS !== "ios")
				return confirm({
					title: input.title,
					message: input.message ?? "",
					confirmLabel: input.confirm.label,
					cancelLabel: input.cancel,
					destructive: input.confirm.destructive,
				});
			return new Promise<boolean | null>((resolve) => {
				ActionSheetIOS.showActionSheetWithOptions(
					{
						title: input.title,
						message: input.message,
						options: input.dismiss
							? [input.confirm.label, input.cancel, input.dismiss]
							: [input.confirm.label, input.cancel],
						cancelButtonIndex: input.dismiss ? 2 : 1,
						...(input.confirm.destructive ? { destructiveButtonIndex: 0 } : {}),
					},
					(index) => resolve(input.dismiss && index === 2 ? null : index === 0),
				);
			});
		},
		[confirm],
	);
}
