import { hashPassword } from "@/lib/auth/password";
import { parseRegisterBody, parseUpdateInput } from "@/lib/auth/validation";
import { firstResult, getDb } from "@/lib/db";
import {
	UniqueConstraintError,
	UserNotFoundError,
	uniqueFieldFromD1Error,
} from "@/lib/users/errors";
import type {
	CreateUserInput,
	PublicUser,
	UpdateUserInput,
	UserRecord,
	UserRow,
} from "@/lib/users/types";

function toPublicUser(row: UserRow): PublicUser {
	return {
		id: row.id,
		firstName: row.first_name,
		lastName: row.last_name,
		username: row.username,
		email: row.email,
	};
}

function toUserRecord(row: UserRow): UserRecord {
	return {
		...toPublicUser(row),
		passwordHash: row.password_hash,
	};
}

function rethrowIfUniqueConstraint(error: unknown): never {
	const message = error instanceof Error ? error.message : String(error);
	if (/UNIQUE|constraint failed/i.test(message)) {
		throw new UniqueConstraintError(uniqueFieldFromD1Error(error));
	}
	throw error;
}

const PUBLIC_COLUMNS = "id, first_name, last_name, username, email, password_hash";

async function selectBy(column: "id" | "username" | "email", value: string): Promise<UserRow | undefined> {
	const db = await getDb();
	const result = await db
		.prepare(`SELECT ${PUBLIC_COLUMNS} FROM users WHERE ${column} = ?1`)
		.bind(value)
		.all<UserRow>();
	return firstResult(result.results);
}

export async function create(input: CreateUserInput): Promise<PublicUser> {
	const parsed = parseRegisterBody(input);
	const id = crypto.randomUUID();
	const passwordHash = await hashPassword(parsed.password);
	const now = new Date().toISOString();
	const db = await getDb();

	try {
		await db
			.prepare(
				`INSERT INTO users (id, first_name, last_name, username, email, password_hash, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
			)
			.bind(
				id,
				parsed.firstName,
				parsed.lastName,
				parsed.username,
				parsed.email,
				passwordHash,
				now,
				now,
			)
			.run();
	} catch (error) {
		rethrowIfUniqueConstraint(error);
	}

	return {
		id,
		firstName: parsed.firstName,
		lastName: parsed.lastName,
		username: parsed.username,
		email: parsed.email,
	};
}

export async function getById(id: string): Promise<PublicUser | null> {
	const row = await selectBy("id", id);
	return row ? toPublicUser(row) : null;
}

export async function getByUsername(username: string): Promise<PublicUser | null> {
	const row = await selectBy("username", username.trim().toLowerCase());
	return row ? toPublicUser(row) : null;
}

export async function getByEmail(email: string): Promise<PublicUser | null> {
	const row = await selectBy("email", email.trim().toLowerCase());
	return row ? toPublicUser(row) : null;
}

export async function getRecordForLogin(
	identifier: string,
): Promise<{ user: PublicUser; passwordHash: string } | null> {
	const value = identifier.trim().toLowerCase();
	if (!value) {
		return null;
	}
	const column = value.includes("@") ? "email" : "username";
	const row = await selectBy(column, value);
	if (!row) {
		return null;
	}
	const record = toUserRecord(row);
	return { user: toPublicUser(row), passwordHash: record.passwordHash };
}

export async function update(id: string, input: UpdateUserInput): Promise<PublicUser> {
	const parsed = parseUpdateInput(input);
	const existing = await selectBy("id", id);
	if (!existing) {
		throw new UserNotFoundError();
	}

	const firstName = parsed.firstName ?? existing.first_name;
	const lastName = parsed.lastName ?? existing.last_name;
	const username = parsed.username ?? existing.username;
	const email = parsed.email ?? existing.email;
	const passwordHash = parsed.password
		? await hashPassword(parsed.password)
		: existing.password_hash;
	const now = new Date().toISOString();
	const db = await getDb();

	try {
		const result = await db
			.prepare(
				`UPDATE users
         SET first_name = ?1, last_name = ?2, username = ?3, email = ?4, password_hash = ?5, updated_at = ?6
         WHERE id = ?7`,
			)
			.bind(firstName, lastName, username, email, passwordHash, now, id)
			.run();
		if (!result.meta.changes) {
			throw new UserNotFoundError();
		}
	} catch (error) {
		if (error instanceof UserNotFoundError) {
			throw error;
		}
		rethrowIfUniqueConstraint(error);
	}

	return { id, firstName, lastName, username, email };
}

export async function remove(id: string): Promise<void> {
	const db = await getDb();
	await db.prepare("DELETE FROM sessions WHERE user_id = ?1").bind(id).run();
	const result = await db.prepare("DELETE FROM users WHERE id = ?1").bind(id).run();
	if (!result.meta.changes) {
		throw new UserNotFoundError();
	}
}

export const userService = {
	create,
	getById,
	getByUsername,
	getByEmail,
	getRecordForLogin,
	update,
	delete: remove,
};
