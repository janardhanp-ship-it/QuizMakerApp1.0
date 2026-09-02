import { jsonError, readJsonBody } from "@/lib/auth/http";
import { getCurrentUser } from "@/lib/auth/session";
import { handleMcqError } from "@/lib/mcqs/http";
import { mcqService } from "@/lib/mcqs/mcq-service";
import { parseAttemptBody } from "@/lib/mcqs/validation";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
	const user = await getCurrentUser();
	if (!user) {
		return jsonError(401, "Not authenticated");
	}
	try {
		const { id } = await context.params;
		const attempts = await mcqService.listAttemptsForOwner(user.id, id);
		return Response.json({ attempts });
	} catch (error) {
		return handleMcqError(error);
	}
}

export async function POST(request: Request, context: RouteContext) {
	const user = await getCurrentUser();
	if (!user) {
		return jsonError(401, "Not authenticated");
	}
	try {
		const { id } = await context.params;
		const body = await readJsonBody(request);
		const { choiceId } = parseAttemptBody(body);
		const attempt = await mcqService.createAttempt(user.id, id, choiceId);
		return Response.json({ attempt }, { status: 201 });
	} catch (error) {
		return handleMcqError(error);
	}
}
