import { ValidationError } from "@/lib/mcqs/errors";
import type { ChoiceInput, CreateMcqInput } from "@/lib/mcqs/types";

const NAME_MAX = 120;
const QUESTION_MAX = 2000;
const BODY_MAX = 500;
const MIN_CHOICES = 2;
const MAX_CHOICES = 6;

function asRecord(body: unknown): Record<string, unknown> {
	if (!body || typeof body !== "object" || Array.isArray(body)) {
		throw new ValidationError({ form: "Invalid request body" });
	}
	return body as Record<string, unknown>;
}

function trimRequired(value: unknown, field: string, fields: Record<string, string>): string {
	if (typeof value !== "string") {
		fields[field] = "This field is required";
		return "";
	}
	const trimmed = value.trim();
	if (!trimmed) {
		fields[field] = "This field is required";
	}
	return trimmed;
}

function parseChoices(raw: unknown, fields: Record<string, string>): ChoiceInput[] {
	if (!Array.isArray(raw)) {
		fields.choices = `Provide ${MIN_CHOICES}–${MAX_CHOICES} choices`;
		return [];
	}
	if (raw.length < MIN_CHOICES || raw.length > MAX_CHOICES) {
		fields.choices = `Provide ${MIN_CHOICES}–${MAX_CHOICES} choices`;
	}
	const choices: ChoiceInput[] = raw.map((item, index) => {
		if (!item || typeof item !== "object" || Array.isArray(item)) {
			fields[`choices.${index}`] = "Each choice needs text";
			return { body: "", isCorrect: false };
		}
		const row = item as Record<string, unknown>;
		const body = trimRequired(row.body, `choices.${index}`, fields);
		if (body.length > BODY_MAX) {
			fields[`choices.${index}`] = `Must be at most ${BODY_MAX} characters`;
		}
		return { body, isCorrect: Boolean(row.isCorrect) };
	});
	const correctCount = choices.filter((choice) => choice.isCorrect).length;
	if (choices.length >= MIN_CHOICES && choices.length <= MAX_CHOICES && correctCount !== 1) {
		fields.choices = "Mark exactly one choice as correct";
	}
	return choices;
}

export function parseMcqBody(body: unknown): CreateMcqInput {
	const record = asRecord(body);
	const fields: Record<string, string> = {};
	const name = trimRequired(record.name, "name", fields);
	if (name.length > NAME_MAX) {
		fields.name = `Must be at most ${NAME_MAX} characters`;
	}
	const question = trimRequired(record.question, "question", fields);
	if (question.length > QUESTION_MAX) {
		fields.question = `Must be at most ${QUESTION_MAX} characters`;
	}
	const choices = parseChoices(record.choices, fields);
	if (Object.keys(fields).length > 0) {
		throw new ValidationError(fields);
	}
	return { name, question, choices };
}

export function parseMcqUpdateBody(body: unknown): {
	name: string;
	question: string;
	choices?: ChoiceInput[];
} {
	const record = asRecord(body);
	const fields: Record<string, string> = {};
	const name = trimRequired(record.name, "name", fields);
	if (name.length > NAME_MAX) {
		fields.name = `Must be at most ${NAME_MAX} characters`;
	}
	const question = trimRequired(record.question, "question", fields);
	if (question.length > QUESTION_MAX) {
		fields.question = `Must be at most ${QUESTION_MAX} characters`;
	}
	if (!("choices" in record) || record.choices === undefined) {
		if (Object.keys(fields).length > 0) {
			throw new ValidationError(fields);
		}
		return { name, question };
	}
	const choices = parseChoices(record.choices, fields);
	if (Object.keys(fields).length > 0) {
		throw new ValidationError(fields);
	}
	return { name, question, choices };
}

export function parseAttemptBody(body: unknown): { choiceId: string } {
	const record = asRecord(body);
	const fields: Record<string, string> = {};
	const choiceId = trimRequired(record.choiceId, "choiceId", fields);
	if (Object.keys(fields).length > 0) {
		throw new ValidationError(fields);
	}
	return { choiceId };
}
