import { jsonError, readJsonBody } from "@/lib/auth/http";
import { getCurrentUser } from "@/lib/auth/session";
import { handleMcqError } from "@/lib/mcqs/http";
import { mcqService } from "@/lib/mcqs/mcq-service";
import { parseMcqBody } from "@/lib/mcqs/validation";

export const dynamic = "force-dynamic";

export async function GET() {
	const user = await getCurrentUser();
	if (!user) {
		return jsonError(401, "Not authenticated");
	}
	try {
		const mcqs = await mcqService.list(user.id);
		return Response.json({ mcqs });
	} catch (error) {
		return handleMcqError(error);
	}
}

export async function POST(request: Request) {
	const user = await getCurrentUser();
	if (!user) {
		return jsonError(401, "Not authenticated");
	}
	try {
		const body = await readJsonBody(request);
		parseMcqBody(body);
		const mcq = await mcqService.create(user.id, body);
		return Response.json({ mcq }, { status: 201 });
	} catch (error) {
		return handleMcqError(error);
	}
}
