import { beforeEach, describe, expect, it, vi } from "vitest";

import { UniqueConstraintError, UserNotFoundError } from "@/lib/users/errors";
import { createFakeD1 } from "@/lib/test/fake-d1";

vi.mock("@/lib/db", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/db")>();
	return {
		...actual,
		getDb: vi.fn(),
	};
});

vi.mock("@/lib/auth/password", () => ({
	hashPassword: vi.fn(async (password: string) => `hashed:${password}`),
	verifyPassword: vi.fn(),
}));

import { getDb } from "@/lib/db";
import { userService } from "@/lib/users/user-service";

const getDbMock = vi.mocked(getDb);

const ada = {
	firstName: "Ada",
	lastName: "Lovelace",
	username: "ada",
	email: "ada@example.com",
	password: "correct-horse-battery",
};

describe("Phase 2: user service", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		const db = createFakeD1();
			getDbMock.mockResolvedValue(db as never);
	});

	it("creates a public user and never returns the password or hash", async () => {
		const user = await userService.create(ada);
		expect(user.username).toBe("ada");
		expect(user.email).toBe("ada@example.com");
		expect(user).not.toHaveProperty("password");
		expect(user).not.toHaveProperty("passwordHash");
		expect(JSON.stringify(user)).not.toContain(ada.password);
	});

	it("stores a hashed password that getRecordForLogin can read", async () => {
		await userService.create(ada);
		const record = await userService.getRecordForLogin("ada");
		expect(record?.passwordHash).toBe("hashed:correct-horse-battery");
		expect(record?.user.email).toBe("ada@example.com");
		expect(await userService.getRecordForLogin("ADA@EXAMPLE.COM")).toEqual(record);
	});

	it("finds users by id, username, and email after create", async () => {
		const created = await userService.create(ada);
		expect(await userService.getById(created.id)).toEqual(created);
		expect(await userService.getByUsername("ADA")).toEqual(created);
		expect(await userService.getByEmail("ADA@EXAMPLE.COM")).toEqual(created);
		expect(await userService.getById("missing")).toBeNull();
	});

	it("throws UniqueConstraintError when username or email is taken", async () => {
		await userService.create(ada);
		await expect(userService.create({ ...ada, email: "other@example.com" })).rejects.toBeInstanceOf(
			UniqueConstraintError,
		);
		await expect(
			userService.create({ ...ada, username: "other", email: "ada@example.com" }),
		).rejects.toBeInstanceOf(UniqueConstraintError);
	});

	it("updates name fields and re-hashes a new password", async () => {
		const created = await userService.create(ada);
		const updated = await userService.update(created.id, {
			firstName: "Augusta",
			password: "new-password-ok",
		});
		expect(updated.firstName).toBe("Augusta");
		expect(updated.lastName).toBe("Lovelace");
		const record = await userService.getRecordForLogin("ada");
		expect(record?.passwordHash).toBe("hashed:new-password-ok");
	});

	it("deletes a user and throws when the user does not exist", async () => {
		const created = await userService.create(ada);
		await userService.delete(created.id);
		expect(await userService.getById(created.id)).toBeNull();
		await expect(userService.delete(created.id)).rejects.toBeInstanceOf(UserNotFoundError);
		await expect(userService.update("missing", { firstName: "X" })).rejects.toBeInstanceOf(
			UserNotFoundError,
		);
	});
});
