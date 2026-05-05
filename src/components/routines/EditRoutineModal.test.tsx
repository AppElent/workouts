import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EditRoutineModal } from "./EditRoutineModal";

vi.mock("convex/react", () => ({
	useQuery: vi.fn(() => []),
}));

vi.mock("@convex/_generated/api", () => ({
	api: {
		exercises: { list: "exercises:list" },
	},
}));

const mockRoutine = {
	_id: "routine1" as never,
	_creationTime: 0,
	userId: "user1",
	name: "Push Day A",
	exercises: [
		{
			exerciseId: "ex1" as never,
			exerciseName: "Bench Press",
			defaultSets: 3,
			defaultReps: 8,
			defaultWeight: 60,
		},
	],
};

describe("EditRoutineModal", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("does not render when closed", () => {
		render(
			<EditRoutineModal
				routine={mockRoutine}
				open={false}
				onClose={vi.fn()}
				onSave={vi.fn()}
			/>,
		);
		expect(screen.queryByRole("dialog")).toBeNull();
	});

	it("pre-populates routine name when open", () => {
		render(
			<EditRoutineModal
				routine={mockRoutine}
				open={true}
				onClose={vi.fn()}
				onSave={vi.fn()}
			/>,
		);
		expect(screen.getByDisplayValue("Push Day A")).toBeTruthy();
	});

	it("pre-populates existing exercises when open", () => {
		render(
			<EditRoutineModal
				routine={mockRoutine}
				open={true}
				onClose={vi.fn()}
				onSave={vi.fn()}
			/>,
		);
		expect(screen.getByText("Bench Press")).toBeTruthy();
	});

	it("disables Save when name is empty", () => {
		render(
			<EditRoutineModal
				routine={mockRoutine}
				open={true}
				onClose={vi.fn()}
				onSave={vi.fn()}
			/>,
		);
		const nameInput = screen.getByDisplayValue("Push Day A");
		fireEvent.change(nameInput, { target: { value: "" } });
		const saveBtn = screen.getByRole("button", { name: /^save$/i });
		expect((saveBtn as HTMLButtonElement).disabled).toBe(true);
	});

	it("disables Save when exercises list is empty", () => {
		render(
			<EditRoutineModal
				routine={mockRoutine}
				open={true}
				onClose={vi.fn()}
				onSave={vi.fn()}
			/>,
		);
		const removeBtn = screen.getByRole("button", {
			name: /remove bench press/i,
		});
		fireEvent.click(removeBtn);
		const saveBtn = screen.getByRole("button", { name: /^save$/i });
		expect((saveBtn as HTMLButtonElement).disabled).toBe(true);
	});

	it("calls onSave with updated data when submitted", () => {
		const onSave = vi.fn();
		render(
			<EditRoutineModal
				routine={mockRoutine}
				open={true}
				onClose={vi.fn()}
				onSave={onSave}
			/>,
		);
		fireEvent.click(screen.getByRole("button", { name: /^save$/i }));
		expect(onSave).toHaveBeenCalledWith({
			name: "Push Day A",
			exercises: [
				{
					exerciseId: "ex1",
					defaultSets: 3,
					defaultReps: 8,
					defaultWeight: 60,
				},
			],
		});
	});

	it("calls onClose when Cancel is clicked", () => {
		const onClose = vi.fn();
		render(
			<EditRoutineModal
				routine={mockRoutine}
				open={true}
				onClose={onClose}
				onSave={vi.fn()}
			/>,
		);
		const cancelBtns = screen.getAllByRole("button", { name: /cancel/i });
		fireEvent.click(cancelBtns[0]);
		expect(onClose).toHaveBeenCalled();
	});
});
