import { NextResponse } from "next/server";
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
import {
	applySessionCookie,
	createSession,
	destroySession,
	getCurrentUser,
	hashToken,
} from "@/lib/auth/session";
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

	it("inserts a hashed token and returns the raw cookie value", async () => {
		const db = createFakeD1();
		getDbMock.mockResolvedValue(db as never);
		const rawCookie = await createSession("user-1");
		expect(db.sessions).toHaveLength(1);
		expect(rawCookie).toMatch(/^[0-9a-f]+$/);
		expect(db.sessions[0]?.token_hash).toBe(await hashToken(rawCookie));
		expect(db.sessions[0]?.token_hash).not.toBe(rawCookie);
	});

	it("sets an HttpOnly session cookie on the HTTP response", () => {
		const response = NextResponse.json({ ok: true });
		applySessionCookie(response, "ab".repeat(32));
		expect(response.cookies.get(SESSION_COOKIE)?.value).toBe("ab".repeat(32));
		expect(response.cookies.get(SESSION_COOKIE)?.httpOnly).toBe(true);
	});

	it("returns null when there is no session cookie", async () => {
		cookieStore.get.mockReturnValue(undefined);
		expect(await getCurrentUser()).toBeNull();
	});

	it("loads the user for a valid unexpired session", async () => {
		const db = createFakeD1();
		getDbMock.mockResolvedValue(db as never);
		const rawCookie = await createSession("user-1");
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

	it("deletes the stored session on logout", async () => {
		const db = createFakeD1();
		getDbMock.mockResolvedValue(db as never);
		const rawCookie = await createSession("user-1");
		cookieStore.get.mockReturnValue({ value: rawCookie });
		await destroySession();
		expect(db.sessions).toHaveLength(0);
	});
});
