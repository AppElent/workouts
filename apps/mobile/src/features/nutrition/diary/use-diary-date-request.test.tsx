import { act, renderHook } from "@testing-library/react-native";
import {
	requestDiaryDate,
	useDiaryDateRequest,
} from "./use-diary-date-request";

describe("asking the diary to show a day", () => {
	it("moves a mounted diary to each requested day", async () => {
		const onRequest = jest.fn();
		await renderHook(() => useDiaryDateRequest(onRequest));
		await act(() => requestDiaryDate("2026-10-02"));
		await act(() => requestDiaryDate("2026-10-03"));
		expect(onRequest.mock.calls).toEqual([["2026-10-02"], ["2026-10-03"]]);
	});

	it("ignores a request made before the diary mounted", async () => {
		requestDiaryDate("2026-09-01");
		const onRequest = jest.fn();
		await renderHook(() => useDiaryDateRequest(onRequest));
		expect(onRequest).not.toHaveBeenCalled();
	});
});
