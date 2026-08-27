import { jsonError } from "@/lib/auth/http";
import { getCurrentUser } from "@/lib/auth/session";

export async function GET() {
	const user = await getCurrentUser();
	if (!user) {
		return jsonError(401, "Not authenticated");
	}
	return Response.json({ user });
}
