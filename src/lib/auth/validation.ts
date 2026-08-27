import { ValidationError } from "@/lib/users/errors";
import type { CreateUserInput, UpdateUserInput } from "@/lib/users/types";

const NAME_MAX = 80;
const USERNAME_PATTERN = /^[a-z0-9_]{3,32}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 128;

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

export function validateName(value: string, field: string, fields: Record<string, string>): string {
	if (value.length > NAME_MAX) {
		fields[field] = `Must be at most ${NAME_MAX} characters`;
	}
	return value;
}

export function normalizeUsername(value: string): string {
	return value.trim().toLowerCase();
}

export function normalizeEmail(value: string): string {
	return value.trim().toLowerCase();
}

export function validateUsername(value: string, fields: Record<string, string>): string {
	const username = normalizeUsername(value);
	if (!USERNAME_PATTERN.test(username)) {
		fields.username = "Use 3–32 characters: lowercase letters, numbers, and underscores";
	}
	return username;
}

export function validateEmail(value: string, fields: Record<string, string>): string {
	const email = normalizeEmail(value);
	if (!EMAIL_PATTERN.test(email) || email.length > 254) {
		fields.email = "Enter a valid email address";
	}
	return email;
}

export function validatePassword(value: unknown, fields: Record<string, string>, required = true): string {
	if (typeof value !== "string") {
		if (required) {
			fields.password = "This field is required";
		}
		return "";
	}
	if (!value) {
		if (required) {
			fields.password = "This field is required";
		}
		return "";
	}
	if (value.length < PASSWORD_MIN) {
		fields.password = `Password must be at least ${PASSWORD_MIN} characters`;
	} else if (value.length > PASSWORD_MAX) {
		fields.password = `Password must be at most ${PASSWORD_MAX} characters`;
	}
	return value;
}

export function parseRegisterBody(body: unknown): CreateUserInput {
	if (!body || typeof body !== "object") {
		throw new ValidationError({ form: "Invalid request body" });
	}
	const input = body as Record<string, unknown>;
	const fields: Record<string, string> = {};
	const firstName = validateName(trimRequired(input.firstName, "firstName", fields), "firstName", fields);
	const lastName = validateName(trimRequired(input.lastName, "lastName", fields), "lastName", fields);
	const username = validateUsername(trimRequired(input.username, "username", fields), fields);
	const email = validateEmail(trimRequired(input.email, "email", fields), fields);
	const password = validatePassword(input.password, fields, true);

	if (Object.keys(fields).length > 0) {
		throw new ValidationError(fields);
	}

	return { firstName, lastName, username, email, password };
}

export function parseLoginBody(body: unknown): { identifier: string; password: string } {
	if (!body || typeof body !== "object") {
		throw new ValidationError({ form: "Invalid request body" });
	}
	const input = body as Record<string, unknown>;
	const fields: Record<string, string> = {};
	const identifier = trimRequired(input.identifier, "identifier", fields).toLowerCase();
	const password = validatePassword(input.password, fields, true);

	if (Object.keys(fields).length > 0) {
		throw new ValidationError(fields);
	}

	return { identifier, password };
}

export function parseUpdateInput(input: UpdateUserInput): UpdateUserInput {
	const fields: Record<string, string> = {};
	const next: UpdateUserInput = {};

	if (input.firstName !== undefined) {
		next.firstName = validateName(trimRequired(input.firstName, "firstName", fields), "firstName", fields);
	}
	if (input.lastName !== undefined) {
		next.lastName = validateName(trimRequired(input.lastName, "lastName", fields), "lastName", fields);
	}
	if (input.username !== undefined) {
		next.username = validateUsername(trimRequired(input.username, "username", fields), fields);
	}
	if (input.email !== undefined) {
		next.email = validateEmail(trimRequired(input.email, "email", fields), fields);
	}
	if (input.password !== undefined) {
		next.password = validatePassword(input.password, fields, true);
	}

	if (Object.keys(fields).length > 0) {
		throw new ValidationError(fields);
	}
	if (Object.keys(next).length === 0) {
		throw new ValidationError({ form: "No fields to update" });
	}
	return next;
}
