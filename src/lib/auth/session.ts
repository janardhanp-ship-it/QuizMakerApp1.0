import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { SESSION_COOKIE, SESSION_TTL_SECONDS } from "@/lib/auth/constants";
import { firstResult, getDb } from "@/lib/db";
import type { PublicUser } from "@/lib/users/types";
import { userService } from "@/lib/users/user-service";

type SessionRow = {
	id: string;
	user_id: string;
	expires_at: string;
};

function bytesToHex(bytes: Uint8Array): string {
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function hashToken(token: string): Promise<string> {
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
	return bytesToHex(new Uint8Array(digest));
}

function cookieOptions(maxAge: number) {
	return {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax" as const,
		path: "/",
		maxAge,
	};
}

export function applySessionCookie(response: NextResponse, token: string): void {
	response.cookies.set(SESSION_COOKIE, token, cookieOptions(SESSION_TTL_SECONDS));
}

export function clearSessionCookie(response: NextResponse): void {
	response.cookies.set(SESSION_COOKIE, "", cookieOptions(0));
}

export async function createSession(userId: string): Promise<string> {
	const token = bytesToHex(crypto.getRandomValues(new Uint8Array(32)));
	const tokenHash = await hashToken(token);
	const now = new Date();
	const expiresAt = new Date(now.getTime() + SESSION_TTL_SECONDS * 1000).toISOString();
	const db = await getDb();

	await db
		.prepare(
			`INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5)`,
		)
		.bind(crypto.randomUUID(), userId, tokenHash, expiresAt, now.toISOString())
		.run();

	return token;
}

export async function destroySession(): Promise<void> {
	const store = await cookies();
	const token = store.get(SESSION_COOKIE)?.value;
	if (!token) {
		return;
	}
	const tokenHash = await hashToken(token);
	const db = await getDb();
	await db.prepare("DELETE FROM sessions WHERE token_hash = ?1").bind(tokenHash).run();
}

export async function getCurrentUser(): Promise<PublicUser | null> {
	const store = await cookies();
	const token = store.get(SESSION_COOKIE)?.value;
	if (!token) {
		return null;
	}

	const tokenHash = await hashToken(token);
	const now = new Date().toISOString();
	const db = await getDb();
	const result = await db
		.prepare(
			`SELECT id, user_id, expires_at
       FROM sessions
       WHERE token_hash = ?1 AND expires_at > ?2`,
		)
		.bind(tokenHash, now)
		.all<SessionRow>();

	const session = firstResult(result.results);
	if (!session) {
		return null;
	}

	return userService.getById(session.user_id);
}
