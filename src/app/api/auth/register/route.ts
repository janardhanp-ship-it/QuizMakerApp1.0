import { NextResponse } from "next/server";

import { applySessionCookie, createSession } from "@/lib/auth/session";
import { parseRegisterBody } from "@/lib/auth/validation";
import { handleAuthError, readJsonBody } from "@/lib/auth/http";
import { userService } from "@/lib/users/user-service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
	try {
		const body = await readJsonBody(request);
		const input = parseRegisterBody(body);
		const user = await userService.create(input);
		const token = await createSession(user.id);
		const response = NextResponse.json({ user }, { status: 201 });
		applySessionCookie(response, token);
		return response;
	} catch (error) {
		return handleAuthError(error);
	}
}
