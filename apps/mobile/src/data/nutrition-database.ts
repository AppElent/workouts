import { openDatabaseSync } from "expo-sqlite";

/** Each repository owns its connection, even when it shares a database file. */
export function openNutritionDatabase(name: string) {
	// SDK 57 Android can release a cached native handle while another JS wrapper
	// still uses it. Independent connections also isolate repository close().
	// https://github.com/expo/expo/issues/48999
	return openDatabaseSync(name, { useNewConnection: true });
}
