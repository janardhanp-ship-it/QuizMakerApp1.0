import { beforeEach, describe, expect, it, vi } from "vitest";

const { getCurrentUser, mcqService } = vi.hoisted(() => ({
	getCurrentUser: vi.fn(),
	mcqService: {
		create: vi.fn(),
		list: vi.fn(),
		getByIdForOwner: vi.fn(),
		update: vi.fn(),
		delete: vi.fn(),
		getPreview: vi.fn(),
		createAttempt: vi.fn(),
		listAttemptsForOwner: vi.fn(),
	},
}));

vi.mock("@/lib/auth/session", () => ({
	getCurrentUser,
}));

vi.mock("@/lib/mcqs/mcq-service", () => ({
	mcqService,
}));

import { GET as listMcqs, POST as createMcq } from "@/app/api/mcqs/route";
import { DELETE as deleteMcq, GET as getMcq, PUT as updateMcq } from "@/app/api/mcqs/[id]/route";
import { GET as listAttempts, POST as createAttempt } from "@/app/api/mcqs/[id]/attempts/route";
import { GET as previewMcq } from "@/app/api/mcqs/[id]/preview/route";
import { AttemptsExistError, McqForbiddenError, McqNotFoundError } from "@/lib/mcqs/errors";

const user = {
	id: "user-1",
	firstName: "Ada",
	lastName: "Lovelace",
	username: "ada",
	email: "ada@example.com",
};

const mcq = {
	id: "mcq-1",
	name: "Photosynthesis",
	question: "Which gas?",
	createdAt: "now",
	updatedAt: "now",
	choices: [
		{ id: "c1", body: "Oxygen", isCorrect: false, position: 0 },
		{ id: "c2", body: "CO2", isCorrect: true, position: 1 },
	],
};

function jsonRequest(url: string, method: string, body?: unknown) {
	return new Request(url, {
		method,
		headers: { "Content-Type": "application/json" },
		body: body === undefined ? undefined : JSON.stringify(body),
	});
}

const idContext = { params: Promise.resolve({ id: "mcq-1" }) };

describe("Phase 4: MCQ HTTP endpoints", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		getCurrentUser.mockResolvedValue(user);
	});

	it("returns 401 when there is no session", async () => {
		getCurrentUser.mockResolvedValue(null);
		const response = await listMcqs();
		expect(response.status).toBe(401);
		expect(mcqService.list).not.toHaveBeenCalled();
	});

	it("lists MCQs with isOwner for the current user", async () => {
		mcqService.list.mockResolvedValue([
			{ id: "mcq-1", name: "Photosynthesis", question: "Which gas?", isOwner: true },
		]);
		const response = await listMcqs();
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			mcqs: [{ id: "mcq-1", name: "Photosynthesis", question: "Which gas?", isOwner: true }],
		});
		expect(mcqService.list).toHaveBeenCalledWith("user-1");
	});

	it("creates an MCQ through the service", async () => {
		mcqService.create.mockResolvedValue(mcq);
		const response = await createMcq(
			jsonRequest("http://localhost/api/mcqs", "POST", {
				name: "Photosynthesis",
				question: "Which gas?",
				choices: [
					{ body: "Oxygen", isCorrect: false },
					{ body: "CO2", isCorrect: true },
				],
			}),
		);
		expect(response.status).toBe(201);
		expect(await response.json()).toEqual({ mcq });
	});

	it("returns 400 when create validation fails", async () => {
		const response = await createMcq(
			jsonRequest("http://localhost/api/mcqs", "POST", {
				name: "Photosynthesis",
				question: "Which gas?",
				choices: [{ body: "Only", isCorrect: true }],
			}),
		);
		expect(response.status).toBe(400);
		expect(mcqService.create).not.toHaveBeenCalled();
	});

	it("returns 403 when the viewer is not the owner", async () => {
		mcqService.getByIdForOwner.mockRejectedValue(new McqForbiddenError());
		const response = await getMcq(jsonRequest("http://localhost/api/mcqs/mcq-1", "GET"), idContext);
		expect(response.status).toBe(403);
	});

	it("returns 404 when the MCQ is missing", async () => {
		mcqService.getByIdForOwner.mockRejectedValue(new McqNotFoundError());
		const response = await getMcq(jsonRequest("http://localhost/api/mcqs/mcq-1", "GET"), idContext);
		expect(response.status).toBe(404);
	});

	it("returns 409 when update is blocked by attempts", async () => {
		mcqService.update.mockRejectedValue(new AttemptsExistError());
		const response = await updateMcq(
			jsonRequest("http://localhost/api/mcqs/mcq-1", "PUT", {
				name: "Photosynthesis",
				question: "Which gas?",
				choices: [
					{ body: "Oxygen", isCorrect: false },
					{ body: "CO2", isCorrect: true },
				],
			}),
			idContext,
		);
		expect(response.status).toBe(409);
	});

	it("deletes an owned MCQ with 204", async () => {
		mcqService.delete.mockResolvedValue(undefined);
		const response = await deleteMcq(jsonRequest("http://localhost/api/mcqs/mcq-1", "DELETE"), idContext);
		expect(response.status).toBe(204);
		expect(mcqService.delete).toHaveBeenCalledWith("mcq-1", "user-1");
	});

	it("returns a preview payload without isCorrect", async () => {
		mcqService.getPreview.mockResolvedValue({
			id: "mcq-1",
			name: "Photosynthesis",
			question: "Which gas?",
			createdAt: "now",
			updatedAt: "now",
			choices: [
				{ id: "c1", body: "Oxygen", position: 0 },
				{ id: "c2", body: "CO2", position: 1 },
			],
		});
		const response = await previewMcq(jsonRequest("http://localhost/api/mcqs/mcq-1/preview", "GET"), idContext);
		expect(response.status).toBe(200);
		const payload = await response.json();
		expect(JSON.stringify(payload)).not.toMatch(/isCorrect/);
		expect(payload.mcq.choices[0]).toEqual({ id: "c1", body: "Oxygen", position: 0 });
	});

	it("records an attempt without accepting client correctness", async () => {
		mcqService.createAttempt.mockResolvedValue({
			id: "a1",
			userId: "user-1",
			mcqId: "mcq-1",
			choiceId: "c2",
			isCorrect: true,
			createdAt: "now",
		});
		const response = await createAttempt(
			jsonRequest("http://localhost/api/mcqs/mcq-1/attempts", "POST", { choiceId: "c2", isCorrect: false }),
			idContext,
		);
		expect(response.status).toBe(201);
		expect(mcqService.createAttempt).toHaveBeenCalledWith("user-1", "mcq-1", "c2");
	});

	it("maps a missing choice on attempt to 404", async () => {
		mcqService.createAttempt.mockRejectedValue(new McqNotFoundError());
		const response = await createAttempt(
			jsonRequest("http://localhost/api/mcqs/mcq-1/attempts", "POST", { choiceId: "nope" }),
			idContext,
		);
		expect(response.status).toBe(404);
	});

	it("lists attempts for the owner", async () => {
		mcqService.listAttemptsForOwner.mockResolvedValue([]);
		const response = await listAttempts(jsonRequest("http://localhost/api/mcqs/mcq-1/attempts", "GET"), idContext);
		expect(response.status).toBe(200);
		expect(mcqService.listAttemptsForOwner).toHaveBeenCalledWith("user-1", "mcq-1");
	});
});
