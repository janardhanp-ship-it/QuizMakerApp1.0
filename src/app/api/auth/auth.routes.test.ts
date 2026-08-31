import { beforeEach, describe, expect, it, vi } from "vitest";

const { applySessionCookie, clearSessionCookie, createSession, destroySession, getCurrentUser, userService } =
	vi.hoisted(() => ({
		applySessionCookie: vi.fn(),
		clearSessionCookie: vi.fn(),
		createSession: vi.fn(),
		destroySession: vi.fn(),
		getCurrentUser: vi.fn(),
		userService: {
			create: vi.fn(),
			getRecordForLogin: vi.fn(),
		},
	}));

vi.mock("@/lib/auth/session", () => ({
	applySessionCookie,
	clearSessionCookie,
	createSession,
	destroySession,
	getCurrentUser,
}));

vi.mock("@/lib/users/user-service", () => ({
	userService,
}));

import { POST as login } from "@/app/api/auth/login/route";
import { POST as logout } from "@/app/api/auth/logout/route";
import { GET as me } from "@/app/api/auth/me/route";
import { POST as register } from "@/app/api/auth/register/route";
import { hashPassword } from "@/lib/auth/password";

const publicUser = {
	id: "user-1",
	firstName: "Ada",
	lastName: "Lovelace",
	username: "ada",
	email: "ada@example.com",
};

function jsonRequest(url: string, body: unknown) {
	return new Request(url, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
}

describe("Phase 3: auth HTTP endpoints", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("registers through the user service, starts a session, and omits the password", async () => {
		userService.create.mockResolvedValue(publicUser);
		createSession.mockResolvedValue("session-token");
		const response = await register(
			jsonRequest("http://localhost/api/auth/register", {
				firstName: "Ada",
				lastName: "Lovelace",
				username: "ada",
				email: "ada@example.com",
				password: "correct-horse-battery",
			}),
		);
		expect(response.status).toBe(201);
		const payload = await response.json();
		expect(payload.user).toEqual(publicUser);
		expect(JSON.stringify(payload)).not.toContain("correct-horse-battery");
		expect(userService.create).toHaveBeenCalled();
		expect(createSession).toHaveBeenCalledWith("user-1");
	});

	it("returns 400 when register validation fails", async () => {
		const response = await register(
			jsonRequest("http://localhost/api/auth/register", {
				firstName: "Ada",
				lastName: "Lovelace",
				username: "ada",
				email: "ada@example.com",
				password: "short",
			}),
		);
		expect(response.status).toBe(400);
		expect(userService.create).not.toHaveBeenCalled();
	});

	it("returns 409 when the user service reports a unique conflict", async () => {
		const { UniqueConstraintError } = await import("@/lib/users/errors");
		userService.create.mockRejectedValue(new UniqueConstraintError("username"));
		const response = await register(
			jsonRequest("http://localhost/api/auth/register", {
				firstName: "Ada",
				lastName: "Lovelace",
				username: "ada",
				email: "ada@example.com",
				password: "correct-horse-battery",
			}),
		);
		expect(response.status).toBe(409);
		const payload = await response.json();
		expect(payload.fields.username).toMatch(/already taken/i);
	});

	it("logs in with a valid password and starts a session", async () => {
		const password = "correct-horse-battery";
		createSession.mockResolvedValue("session-token");
		userService.getRecordForLogin.mockResolvedValue({
			user: publicUser,
			passwordHash: await hashPassword(password),
		});
		const response = await login(
			jsonRequest("http://localhost/api/auth/login", { identifier: "ada", password }),
		);
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ user: publicUser });
		expect(createSession).toHaveBeenCalledWith("user-1");
	});

	it("returns the same 401 for a missing user and a wrong password", async () => {
		userService.getRecordForLogin.mockResolvedValue(null);
		const missing = await login(
			jsonRequest("http://localhost/api/auth/login", {
				identifier: "ada",
				password: "correct-horse-battery",
			}),
		);
		expect(missing.status).toBe(401);
		expect(await missing.json()).toEqual({ error: "Invalid username/email or password" });

		userService.getRecordForLogin.mockResolvedValue({
			user: publicUser,
			passwordHash: await hashPassword("correct-horse-battery"),
		});
		const wrong = await login(
			jsonRequest("http://localhost/api/auth/login", {
				identifier: "ada",
				password: "definitely-wrong",
			}),
		);
		expect(wrong.status).toBe(401);
		expect(await wrong.json()).toEqual({ error: "Invalid username/email or password" });
		expect(createSession).not.toHaveBeenCalled();
	});

	it("logs out even when no session exists", async () => {
		destroySession.mockResolvedValue(undefined);
		const response = await logout();
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ ok: true });
		expect(destroySession).toHaveBeenCalled();
	});

	it("returns 401 from /me without a user and 200 with one", async () => {
		getCurrentUser.mockResolvedValue(null);
		const unauthorized = await me();
		expect(unauthorized.status).toBe(401);
		getCurrentUser.mockResolvedValue(publicUser);
		const authorized = await me();
		expect(authorized.status).toBe(200);
		expect(await authorized.json()).toEqual({ user: publicUser });
	});
});
