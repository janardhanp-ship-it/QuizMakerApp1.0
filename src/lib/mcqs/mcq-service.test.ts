import { beforeEach, describe, expect, it, vi } from "vitest";

import { AttemptsExistError, McqForbiddenError, McqNotFoundError, ValidationError } from "@/lib/mcqs/errors";
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
	{ body: "Oxygen", isCorrect: false },
	{ body: "Carbon dioxide", isCorrect: true },
];

describe("Phase 2: MCQ service", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		getDbMock.mockResolvedValue(createFakeD1() as never);
	});

	it("creates an MCQ with choices and assigns positions from array order", async () => {
		const mcq = await mcqService.create("user-1", {
			name: "Photosynthesis",
			question: "Which gas do plants absorb?",
			choices: twoChoices,
		});
		expect(mcq.name).toBe("Photosynthesis");
		expect(mcq.choices).toHaveLength(2);
		expect(mcq.choices[0]).toMatchObject({ body: "Oxygen", isCorrect: false, position: 0 });
		expect(mcq.choices[1]).toMatchObject({ body: "Carbon dioxide", isCorrect: true, position: 1 });
	});

	it("lists all MCQs and marks ownership for the viewer", async () => {
		await mcqService.create("user-1", {
			name: "Mine",
			question: "Owned by user 1",
			choices: twoChoices,
		});
		await mcqService.create("user-2", {
			name: "Theirs",
			question: "Owned by user 2",
			choices: twoChoices,
		});
		const listed = await mcqService.list("user-1");
		expect(listed).toHaveLength(2);
		expect(listed.find((item) => item.name === "Mine")?.isOwner).toBe(true);
		expect(listed.find((item) => item.name === "Theirs")?.isOwner).toBe(false);
		expect(listed[0]).not.toHaveProperty("choices");
	});

	it("forbids another user from reading the owner payload", async () => {
		const created = await mcqService.create("user-1", {
			name: "Private",
			question: "Stem",
			choices: twoChoices,
		});
		await expect(mcqService.getByIdForOwner(created.id, "user-2")).rejects.toBeInstanceOf(McqForbiddenError);
		expect(await mcqService.getByIdForOwner(created.id, "user-1")).toMatchObject({ name: "Private" });
	});

	it("rejects fewer than two or more than six choices", async () => {
		await expect(
			mcqService.create("user-1", {
				name: "Too few",
				question: "Stem",
				choices: [{ body: "Only", isCorrect: true }],
			}),
		).rejects.toBeInstanceOf(ValidationError);

		await expect(
			mcqService.create("user-1", {
				name: "Too many",
				question: "Stem",
				choices: [
					{ body: "A", isCorrect: true },
					{ body: "B", isCorrect: false },
					{ body: "C", isCorrect: false },
					{ body: "D", isCorrect: false },
					{ body: "E", isCorrect: false },
					{ body: "F", isCorrect: false },
					{ body: "G", isCorrect: false },
				],
			}),
		).rejects.toBeInstanceOf(ValidationError);
	});

	it("rejects zero or more than one correct choice", async () => {
		await expect(
			mcqService.create("user-1", {
				name: "None correct",
				question: "Stem",
				choices: [
					{ body: "A", isCorrect: false },
					{ body: "B", isCorrect: false },
				],
			}),
		).rejects.toBeInstanceOf(ValidationError);

		await expect(
			mcqService.create("user-1", {
				name: "Two correct",
				question: "Stem",
				choices: [
					{ body: "A", isCorrect: true },
					{ body: "B", isCorrect: true },
				],
			}),
		).rejects.toBeInstanceOf(ValidationError);
	});

	it("updates name, question, and choices when there are no attempts", async () => {
		const created = await mcqService.create("user-1", {
			name: "Old",
			question: "Old stem",
			choices: twoChoices,
		});
		const updated = await mcqService.update(created.id, "user-1", {
			name: "New",
			question: "New stem",
			choices: [
				{ body: "One", isCorrect: false },
				{ body: "Two", isCorrect: true },
				{ body: "Three", isCorrect: false },
			],
		});
		expect(updated.name).toBe("New");
		expect(updated.choices).toHaveLength(3);
		expect(updated.choices.find((choice) => choice.isCorrect)?.body).toBe("Two");
	});

	it("deletes an MCQ so it no longer lists", async () => {
		const created = await mcqService.create("user-1", {
			name: "Gone",
			question: "Stem",
			choices: twoChoices,
		});
		await mcqService.delete(created.id, "user-1");
		expect(await mcqService.list("user-1")).toEqual([]);
		await expect(mcqService.delete(created.id, "user-1")).rejects.toBeInstanceOf(McqNotFoundError);
	});

	it("rejects choice updates when attempts exist but allows name-only updates", async () => {
		const created = await mcqService.create("user-1", {
			name: "Locked",
			question: "Stem",
			choices: twoChoices,
		});
		await mcqService.createAttempt("user-9", created.id, created.choices[0].id);
		await expect(
			mcqService.update(created.id, "user-1", {
				name: "Changed",
				question: "Stem",
				choices: twoChoices,
			}),
		).rejects.toBeInstanceOf(AttemptsExistError);
		const renamed = await mcqService.update(created.id, "user-1", {
			name: "Renamed",
			question: "Stem",
		});
		expect(renamed.name).toBe("Renamed");
		expect(renamed.choices).toHaveLength(2);
	});

	it("returns a preview without isCorrect", async () => {
		const created = await mcqService.create("user-1", {
			name: "Q",
			question: "Stem",
			choices: twoChoices,
		});
		const preview = await mcqService.getPreview(created.id);
		expect(preview.choices[0]).not.toHaveProperty("isCorrect");
		expect(JSON.stringify(preview)).not.toMatch(/isCorrect/);
	});

	it("cascades choices and attempts when the MCQ is deleted", async () => {
		const db = createFakeD1();
		getDbMock.mockResolvedValue(db as never);
		const created = await mcqService.create("user-1", {
			name: "Gone",
			question: "Stem",
			choices: twoChoices,
		});
		await mcqService.createAttempt("user-9", created.id, created.choices[0].id);
		expect(db.choices.length).toBeGreaterThan(0);
		expect(db.attempts.length).toBe(1);
		await mcqService.delete(created.id, "user-1");
		expect(db.mcqs).toHaveLength(0);
		expect(db.choices).toHaveLength(0);
		expect(db.attempts).toHaveLength(0);
	});

	it("rejects a blank name or question", async () => {
		await expect(
			mcqService.create("user-1", {
				name: "   ",
				question: "Stem",
				choices: twoChoices,
			}),
		).rejects.toBeInstanceOf(ValidationError);
		await expect(
			mcqService.create("user-1", {
				name: "Title",
				question: "   ",
				choices: twoChoices,
			}),
		).rejects.toBeInstanceOf(ValidationError);
	});
});
