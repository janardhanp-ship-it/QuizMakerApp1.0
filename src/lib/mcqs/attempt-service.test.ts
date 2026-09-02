import { beforeEach, describe, expect, it, vi } from "vitest";

import { McqForbiddenError, McqNotFoundError } from "@/lib/mcqs/errors";
import { createFakeD1 } from "@/lib/test/fake-d1";

vi.mock("@/lib/db", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/db")>();
	return {
		...actual,
		getDb: vi.fn(),
	};
});

import { getDb } from "@/lib/db";
import { mcqService } from "@/lib/mcqs/mcq-service";

const getDbMock = vi.mocked(getDb);

const twoChoices = [
	{ body: "Wrong", isCorrect: false },
	{ body: "Right", isCorrect: true },
];

describe("Phase 3: MCQ attempts", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		getDbMock.mockResolvedValue(createFakeD1() as never);
	});

	it("records whether the selected choice is correct from stored data, not the client", async () => {
		const mcq = await mcqService.create("owner", {
			name: "Q",
			question: "Stem",
			choices: twoChoices,
		});
		const wrong = await mcqService.createAttempt("taker", mcq.id, mcq.choices[0].id);
		expect(wrong.isCorrect).toBe(false);
		expect(wrong.choiceId).toBe(mcq.choices[0].id);
		expect(wrong.userId).toBe("taker");
		expect(wrong).not.toHaveProperty("body");

		const right = await mcqService.createAttempt("taker", mcq.id, mcq.choices[1].id);
		expect(right.isCorrect).toBe(true);
	});

	it("rejects an attempt whose choice does not belong to the MCQ", async () => {
		const first = await mcqService.create("owner", {
			name: "A",
			question: "Stem",
			choices: twoChoices,
		});
		const second = await mcqService.create("owner", {
			name: "B",
			question: "Stem",
			choices: twoChoices,
		});
		await expect(
			mcqService.createAttempt("taker", first.id, second.choices[0].id),
		).rejects.toBeInstanceOf(McqNotFoundError);
		await expect(mcqService.createAttempt("taker", "missing", first.choices[0].id)).rejects.toBeInstanceOf(
			McqNotFoundError,
		);
	});

	it("lists attempts for the owner and hides them from other users", async () => {
		const mcq = await mcqService.create("owner", {
			name: "Q",
			question: "Stem",
			choices: twoChoices,
		});
		await mcqService.createAttempt("taker", mcq.id, mcq.choices[1].id);
		const listed = await mcqService.listAttemptsForOwner("owner", mcq.id);
		expect(listed).toHaveLength(1);
		expect(listed[0].isCorrect).toBe(true);
		await expect(mcqService.listAttemptsForOwner("other", mcq.id)).rejects.toBeInstanceOf(McqForbiddenError);
	});
});
