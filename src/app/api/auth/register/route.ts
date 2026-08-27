import { createSession } from "@/lib/auth/session";
import { parseRegisterBody } from "@/lib/auth/validation";
import { handleAuthError, readJsonBody } from "@/lib/auth/http";
import { userService } from "@/lib/users/user-service";

export async function POST(request: Request) {
	try {
		const body = await readJsonBody(request);
		const input = parseRegisterBody(body);
		const user = await userService.create(input);
		await createSession(user.id);
		return Response.json({ user }, { status: 201 });
	} catch (error) {
		return handleAuthError(error);
	}
}
