import { NextResponse } from "next/server";

import { handleAuthError } from "@/lib/auth/http";
import { clearSessionCookie, destroySession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function POST() {
	try {
		await destroySession();
		const response = NextResponse.json({ ok: true });
		clearSessionCookie(response);
		return response;
	} catch (error) {
		return handleAuthError(error);
	}
}
