import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { parseLoginBody } from "@/lib/auth/validation";
import { handleAuthError, jsonError, readJsonBody } from "@/lib/auth/http";
import { userService } from "@/lib/users/user-service";

const INVALID_CREDENTIALS = "Invalid username/email or password";

export async function POST(request: Request) {
	try {
		const body = await readJsonBody(request);
		const { identifier, password } = parseLoginBody(body);
		const record = await userService.getRecordForLogin(identifier);
		if (!record) {
			return jsonError(401, INVALID_CREDENTIALS);
		}
		const matches = await verifyPassword(password, record.passwordHash);
		if (!matches) {
			return jsonError(401, INVALID_CREDENTIALS);
		}
		await createSession(record.user.id);
		return Response.json({ user: record.user });
	} catch (error) {
		return handleAuthError(error);
	}
}
