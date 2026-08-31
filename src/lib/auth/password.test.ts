import { describe, expect, it } from "vitest";

import { hashPassword, PBKDF2_ITERATIONS, verifyPassword } from "@/lib/auth/password";
import { parseLoginBody, parseRegisterBody, parseUpdateInput } from "@/lib/auth/validation";
import { ValidationError } from "@/lib/users/errors";

const validRegister = {
	firstName: " Ada ",
	lastName: "Lovelace",
	username: "Ada_1",
	email: "Ada@Example.COM",
	password: "correct-horse-battery",
};

describe("Phase 2: password hashing", () => {
	it("stores a salted PBKDF2 hash that does not contain the plaintext password", async () => {
		const password = "correct-horse-battery";
		const hash = await hashPassword(password);
		expect(hash.startsWith(`pbkdf2-sha256:${PBKDF2_ITERATIONS}:`)).toBe(true);
		expect(hash).not.toContain(password);
		expect(await verifyPassword(password, hash)).toBe(true);
		expect(await verifyPassword("wrong-password", hash)).toBe(false);
	});

	it("rejects a malformed stored hash instead of throwing", async () => {
		expect(await verifyPassword("anything", "not-a-hash")).toBe(false);
	});
});

describe("Phase 2: register and update validation", () => {
	it("normalizes username and email and keeps the password for hashing", () => {
		expect(parseRegisterBody(validRegister)).toEqual({
			firstName: "Ada",
			lastName: "Lovelace",
			username: "ada_1",
			email: "ada@example.com",
			password: "correct-horse-battery",
		});
	});

	it("rejects a short password and an invalid username", () => {
		expect(() => parseRegisterBody({ ...validRegister, password: "short" })).toThrow(ValidationError);
		expect(() => parseRegisterBody({ ...validRegister, username: "ab" })).toThrow(ValidationError);
		try {
			parseRegisterBody({ ...validRegister, email: "not-an-email" });
		} catch (error) {
			expect(error).toBeInstanceOf(ValidationError);
			expect((error as ValidationError).fields.email).toMatch(/valid email/i);
		}
	});

	it("rejects empty login credentials", () => {
		expect(() => parseLoginBody({})).toThrow(ValidationError);
		expect(parseLoginBody({ identifier: "Ada", password: "correct-horse-battery" })).toEqual({
			identifier: "ada",
			password: "correct-horse-battery",
		});
	});

	it("rejects an empty update payload", () => {
		expect(() => parseUpdateInput({})).toThrow(ValidationError);
	});
});
