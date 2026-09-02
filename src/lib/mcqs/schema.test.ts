import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const migrationsDir = join(repoRoot, "migrations");

function mcqMigrationSql(): string {
	const files = readdirSync(migrationsDir).filter((name) => name.endsWith(".sql"));
	return files.map((name) => readFileSync(join(migrationsDir, name), "utf8")).join("\n");
}

describe("Phase 1: MCQ D1 schema", () => {
	it("does not alter the original users and sessions migration", () => {
		const original = join(migrationsDir, "0001_create_users_and_sessions.sql");
		expect(existsSync(original)).toBe(true);
		const sql = readFileSync(original, "utf8");
		expect(sql).not.toMatch(/CREATE TABLE mcqs/);
		expect(sql).not.toMatch(/CREATE TABLE choices/);
		expect(sql).not.toMatch(/CREATE TABLE attempts/);
	});

	it("adds mcqs, choices, and attempts in a migration after 0001", () => {
		const files = readdirSync(migrationsDir).filter((name) => name.endsWith(".sql"));
		expect(files.some((name) => name.startsWith("0001"))).toBe(true);
		expect(files.some((name) => !name.startsWith("0001") && name.endsWith(".sql"))).toBe(true);
	});

	it("creates mcqs with id, name, question, timestamps, and created_by", () => {
		const sql = mcqMigrationSql();
		expect(sql).toMatch(/CREATE TABLE mcqs/);
		expect(sql).toMatch(/CREATE TABLE mcqs[\s\S]*question TEXT NOT NULL/);
		expect(sql).not.toMatch(/CREATE TABLE mcqs[\s\S]*description TEXT/);
		for (const column of ["id", "created_by", "name", "question", "created_at", "updated_at"]) {
			expect(sql).toContain(column);
		}
		expect(sql).toMatch(/FOREIGN KEY \(created_by\) REFERENCES users\(id\)/);
		expect(sql).toMatch(/CREATE TABLE mcqs[\s\S]*ON DELETE CASCADE/);
		expect(sql).toContain("CREATE INDEX idx_mcqs_created_by");
		expect(sql).toContain("CREATE INDEX idx_mcqs_updated_at");
	});

	it("creates choices with a foreign key to mcqs and a boolean-safe is_correct", () => {
		const sql = mcqMigrationSql();
		expect(sql).toMatch(/CREATE TABLE choices/);
		for (const column of ["id", "mcq_id", "body", "is_correct", "position", "created_at", "updated_at"]) {
			expect(sql).toContain(column);
		}
		expect(sql).toMatch(/FOREIGN KEY \(mcq_id\) REFERENCES mcqs\(id\)/);
		expect(sql).toMatch(/CREATE TABLE choices[\s\S]*ON DELETE CASCADE/);
		expect(sql).toMatch(/CREATE TABLE choices[\s\S]*CHECK \(is_correct IN \(0, 1\)\)/);
		expect(sql).toContain("CREATE INDEX idx_choices_mcq_id");
		expect(sql).toContain("CREATE UNIQUE INDEX idx_choices_mcq_id_position");
	});

	it("creates attempts that store user, question, selected choice, and correctness", () => {
		const sql = mcqMigrationSql();
		expect(sql).toMatch(/CREATE TABLE attempts/);
		for (const column of ["id", "user_id", "mcq_id", "choice_id", "is_correct", "created_at"]) {
			expect(sql).toContain(column);
		}
		expect(sql).toMatch(/FOREIGN KEY \(user_id\) REFERENCES users\(id\)/);
		expect(sql).toMatch(/FOREIGN KEY \(mcq_id\) REFERENCES mcqs\(id\)/);
		expect(sql).toMatch(/FOREIGN KEY \(choice_id\) REFERENCES choices\(id\)/);
		expect(sql).toMatch(/CREATE TABLE attempts[\s\S]*CHECK \(is_correct IN \(0, 1\)\)/);
		expect(sql).toContain("CREATE INDEX idx_attempts_user_id");
		expect(sql).toContain("CREATE INDEX idx_attempts_mcq_id");
		expect(sql).toContain("CREATE INDEX idx_attempts_user_mcq");
	});
});
