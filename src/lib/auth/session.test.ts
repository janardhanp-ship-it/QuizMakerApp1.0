import { beforeEach, describe, expect, it, vi } from "vitest";

import { SESSION_COOKIE } from "@/lib/auth/constants";
import { createFakeD1 } from "@/lib/test/fake-d1";

const cookieStore = {
	get: vi.fn(),
	set: vi.fn(),
};

vi.mock("next/headers", () => ({
	cookies: vi.fn(async () => cookieStore),
}));

vi.mock("@/lib/db", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/db")>();
	return {
		...actual,
		getDb: vi.fn(),
	};
});

vi.mock("@/lib/users/user-service", () => ({
	userService: {
		getById: vi.fn(),
	},
}));

import { getDb } from "@/lib/db";
import { createSession, destroySession, getCurrentUser, hashToken } from "@/lib/auth/session";
import { userService } from "@/lib/users/user-service";

const getDbMock = vi.mocked(getDb);

describe("Phase 3: sessions", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("hashes the session token with SHA-256 so the raw cookie is not stored", async () => {
		const token = "aa".repeat(32);
		const hash = await hashToken(token);
		expect(hash).toHaveLength(64);
		expect(hash).not.toBe(token);
		expect(hash).toMatch(/^[0-9a-f]+$/);
	});

	it("inserts a hashed token and sets the HttpOnly cookie to the raw token", async () => {
		const db = createFakeD1();
		getDbMock.mockResolvedValue(db as never);
		await createSession("user-1");
		expect(db.sessions).toHaveLength(1);
		const rawCookie = cookieStore.set.mock.calls[0]?.[1] as string;
		expect(rawCookie).toMatch(/^[0-9a-f]+$/);
		expect(db.sessions[0]?.token_hash).toBe(await hashToken(rawCookie));
		expect(db.sessions[0]?.token_hash).not.toBe(rawCookie);
		expect(cookieStore.set).toHaveBeenCalledWith(
			SESSION_COOKIE,
			rawCookie,
			expect.objectContaining({ httpOnly: true, path: "/", sameSite: "lax" }),
		);
	});

	it("returns null when there is no session cookie", async () => {
		cookieStore.get.mockReturnValue(undefined);
		expect(await getCurrentUser()).toBeNull();
	});

	it("loads the user for a valid unexpired session", async () => {
		const db = createFakeD1();
		getDbMock.mockResolvedValue(db as never);
		await createSession("user-1");
		const rawCookie = cookieStore.set.mock.calls[0]?.[1] as string;
		cookieStore.get.mockReturnValue({ value: rawCookie });
		vi.mocked(userService.getById).mockResolvedValue({
			id: "user-1",
			firstName: "Ada",
			lastName: "Lovelace",
			username: "ada",
			email: "ada@example.com",
		});
		const user = await getCurrentUser();
		expect(user?.id).toBe("user-1");
	});

	it("deletes the stored session and clears the cookie on logout", async () => {
		const db = createFakeD1();
		getDbMock.mockResolvedValue(db as never);
		await createSession("user-1");
		const rawCookie = cookieStore.set.mock.calls[0]?.[1] as string;
		cookieStore.get.mockReturnValue({ value: rawCookie });
		await destroySession();
		expect(db.sessions).toHaveLength(0);
		expect(cookieStore.set).toHaveBeenCalledWith(
			SESSION_COOKIE,
			"",
			expect.objectContaining({ maxAge: 0 }),
		);
	});
});
