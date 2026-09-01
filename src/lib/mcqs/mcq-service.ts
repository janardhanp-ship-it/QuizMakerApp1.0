import { firstResult, getDb } from "@/lib/db";
import { AttemptsExistError, McqForbiddenError, McqNotFoundError } from "@/lib/mcqs/errors";
import type {
	AttemptRow,
	ChoiceRow,
	CreateMcqInput,
	McqListItem,
	McqRow,
	McqWithChoices,
	PreviewMcq,
	PublicAttempt,
	PublicChoice,
	PublicMcq,
} from "@/lib/mcqs/types";
import { parseMcqBody, parseMcqUpdateBody } from "@/lib/mcqs/validation";

function toPublicMcq(row: McqRow): PublicMcq {
	return {
		id: row.id,
		name: row.name,
		question: row.question,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

function toPublicChoice(row: ChoiceRow): PublicChoice {
	return {
		id: row.id,
		body: row.body,
		isCorrect: row.is_correct === 1,
		position: row.position,
	};
}

async function insertChoices(mcqId: string, input: CreateMcqInput, now: string): Promise<PublicChoice[]> {
	const db = await getDb();
	const choices: PublicChoice[] = [];
	for (const [index, choice] of input.choices.entries()) {
		const id = crypto.randomUUID();
		const position = index;
		await db
			.prepare(
				`INSERT INTO choices (id, mcq_id, body, is_correct, position, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
			)
			.bind(id, mcqId, choice.body, choice.isCorrect ? 1 : 0, position, now, now)
			.run();
		choices.push({ id, body: choice.body, isCorrect: choice.isCorrect, position });
	}
	return choices;
}

async function loadChoices(mcqId: string): Promise<ChoiceRow[]> {
	const db = await getDb();
	const result = await db
		.prepare(
			`SELECT id, mcq_id, body, is_correct, position, created_at, updated_at FROM choices WHERE mcq_id = ?1 ORDER BY position ASC`,
		)
		.bind(mcqId)
		.all<ChoiceRow>();
	return result.results ?? [];
}

async function loadMcqRow(id: string): Promise<McqRow | undefined> {
	const db = await getDb();
	const result = await db
		.prepare(`SELECT id, created_by, name, question, created_at, updated_at FROM mcqs WHERE id = ?1`)
		.bind(id)
		.all<McqRow>();
	return firstResult(result.results);
}

async function requireOwnedRow(id: string, ownerId: string): Promise<McqRow> {
	const row = await loadMcqRow(id);
	if (!row) {
		throw new McqNotFoundError();
	}
	if (row.created_by !== ownerId) {
		throw new McqForbiddenError();
	}
	return row;
}

async function hasAttempts(mcqId: string): Promise<boolean> {
	const db = await getDb();
	const result = await db.prepare(`SELECT id FROM attempts WHERE mcq_id = ?1`).bind(mcqId).all<{ id: string }>();
	return (result.results ?? []).length > 0;
}

export async function create(ownerId: string, raw: unknown): Promise<McqWithChoices> {
	const input = parseMcqBody(raw);
	const id = crypto.randomUUID();
	const now = new Date().toISOString();
	const db = await getDb();
	await db
		.prepare(
			`INSERT INTO mcqs (id, created_by, name, question, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
			)
		.bind(id, ownerId, input.name, input.question, now, now)
		.run();
	const choices = await insertChoices(id, input, now);
	return { id, name: input.name, question: input.question, createdAt: now, updatedAt: now, choices };
}

export async function list(viewerId: string): Promise<McqListItem[]> {
	const db = await getDb();
	const result = await db
		.prepare(
			`SELECT id, created_by, name, question, created_at, updated_at FROM mcqs ORDER BY updated_at DESC`,
		)
		.all<McqRow>();
	return (result.results ?? []).map((row) => ({
		...toPublicMcq(row),
		isOwner: row.created_by === viewerId,
	}));
}

export async function getByIdForOwner(id: string, ownerId: string): Promise<McqWithChoices> {
	const row = await requireOwnedRow(id, ownerId);
	return { ...toPublicMcq(row), choices: (await loadChoices(row.id)).map(toPublicChoice) };
}

export async function update(id: string, ownerId: string, raw: unknown): Promise<McqWithChoices> {
	const input = parseMcqUpdateBody(raw);
	const existing = await requireOwnedRow(id, ownerId);
	if (input.choices && (await hasAttempts(id))) {
		throw new AttemptsExistError();
	}
	const now = new Date().toISOString();
	const db = await getDb();
	await db
		.prepare(`UPDATE mcqs SET name = ?1, question = ?2, updated_at = ?3 WHERE id = ?4 AND created_by = ?5`)
		.bind(input.name, input.question, now, id, ownerId)
		.run();
	let choices: PublicChoice[];
	if (input.choices) {
		await db.prepare(`DELETE FROM choices WHERE mcq_id = ?1`).bind(id).run();
		choices = await insertChoices(id, { name: input.name, question: input.question, choices: input.choices }, now);
	} else {
		choices = (await loadChoices(id)).map(toPublicChoice);
	}
	return {
		id,
		name: input.name,
		question: input.question,
		createdAt: existing.created_at,
		updatedAt: now,
		choices,
	};
}

export async function remove(id: string, ownerId: string): Promise<void> {
	await requireOwnedRow(id, ownerId);
	const db = await getDb();
	await db.prepare(`DELETE FROM mcqs WHERE id = ?1 AND created_by = ?2`).bind(id, ownerId).run();
}

export async function getPreview(id: string): Promise<PreviewMcq> {
	const row = await loadMcqRow(id);
	if (!row) {
		throw new McqNotFoundError();
	}
	const choices = (await loadChoices(id)).map((choice) => ({
		id: choice.id,
		body: choice.body,
		position: choice.position,
	}));
	return { ...toPublicMcq(row), choices };
}

export async function createAttempt(userId: string, mcqId: string, choiceId: string): Promise<PublicAttempt> {
	const row = await loadMcqRow(mcqId);
	if (!row) {
		throw new McqNotFoundError();
	}
	const db = await getDb();
	const choiceResult = await db
		.prepare(
			`SELECT id, mcq_id, body, is_correct, position, created_at, updated_at FROM choices WHERE id = ?1 AND mcq_id = ?2`,
		)
		.bind(choiceId, mcqId)
		.all<ChoiceRow>();
	const choice = firstResult(choiceResult.results);
	if (!choice) {
		throw new McqNotFoundError();
	}
	const id = crypto.randomUUID();
	const now = new Date().toISOString();
	const isCorrect = choice.is_correct === 1 ? 1 : 0;
	await db
		.prepare(
			`INSERT INTO attempts (id, user_id, mcq_id, choice_id, is_correct, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
		)
		.bind(id, userId, mcqId, choiceId, isCorrect, now)
		.run();
	return { id, userId, mcqId, choiceId, isCorrect: isCorrect === 1, createdAt: now };
}

export async function listAttemptsForOwner(ownerId: string, mcqId: string): Promise<PublicAttempt[]> {
	await requireOwnedRow(mcqId, ownerId);
	const db = await getDb();
	const result = await db
		.prepare(
			`SELECT id, user_id, mcq_id, choice_id, is_correct, created_at FROM attempts WHERE mcq_id = ?1 ORDER BY created_at DESC`,
		)
		.bind(mcqId)
		.all<AttemptRow>();
	return (result.results ?? []).map((attempt) => ({
		id: attempt.id,
		userId: attempt.user_id,
		mcqId: attempt.mcq_id,
		choiceId: attempt.choice_id,
		isCorrect: attempt.is_correct === 1,
		createdAt: attempt.created_at,
	}));
}

export const mcqService = {
	create,
	list,
	getByIdForOwner,
	update,
	delete: remove,
	getPreview,
	createAttempt,
	listAttemptsForOwner,
};
