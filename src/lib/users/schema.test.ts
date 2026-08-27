import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("Phase 1: D1 schema and binding", () => {
	it("binds the D1 database as DB in wrangler.jsonc", () => {
		const wrangler = readFileSync(join(repoRoot, "wrangler.jsonc"), "utf8");
		expect(wrangler).toMatch(/"binding"\s*:\s*"DB"/);
		expect(wrangler).toMatch(/"database_name"\s*:\s*"quizmaker-db"/);
	});

	it("creates users with identity columns and a password hash, not a plaintext password column", () => {
		const sql = readFileSync(join(repoRoot, "migrations/0001_create_users_and_sessions.sql"), "utf8");
		expect(sql).toMatch(/CREATE TABLE users/);
		for (const column of ["id", "first_name", "last_name", "username", "email", "password_hash"]) {
			expect(sql).toContain(column);
		}
		expect(sql).not.toMatch(/CREATE TABLE users[\s\S]*\bpassword TEXT/i);
		expect(sql).toContain("CREATE UNIQUE INDEX idx_users_username");
		expect(sql).toContain("CREATE UNIQUE INDEX idx_users_email");
	});

	it("creates sessions that store a token hash, not the raw cookie value", () => {
		const sql = readFileSync(join(repoRoot, "migrations/0001_create_users_and_sessions.sql"), "utf8");
		expect(sql).toMatch(/CREATE TABLE sessions/);
		expect(sql).toContain("token_hash");
		expect(sql).toContain("user_id");
		expect(sql).toContain("expires_at");
		expect(sql).not.toMatch(/CREATE TABLE sessions[\s\S]*\btoken TEXT NOT NULL/);
	});
});
