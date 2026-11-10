import { useRouter } from "expo-router";
import { WodLibraryScreen } from "../../src/features/training/wods/wod-library-screen";

export default function WodsRoute() {
	const router = useRouter();
	return (
		<WodLibraryScreen
			onOpen={(id) => router.push({ pathname: "/wod/[id]", params: { id } })}
			onCreate={() => router.push("/wod-editor")}
		/>
	);
}
