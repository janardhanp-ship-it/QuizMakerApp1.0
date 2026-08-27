import { handleAuthError } from "@/lib/auth/http";
import { destroySession } from "@/lib/auth/session";

export async function POST() {
	try {
		await destroySession();
		return Response.json({ ok: true });
	} catch (error) {
		return handleAuthError(error);
	}
}
