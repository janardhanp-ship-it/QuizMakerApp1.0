import { jsonError, readJsonBody } from "@/lib/auth/http";
import { getCurrentUser } from "@/lib/auth/session";
import { handleMcqError } from "@/lib/mcqs/http";
import { mcqService } from "@/lib/mcqs/mcq-service";
import { parseMcqUpdateBody } from "@/lib/mcqs/validation";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
	const user = await getCurrentUser();
	if (!user) {
		return jsonError(401, "Not authenticated");
	}
	try {
		const { id } = await context.params;
		const mcq = await mcqService.getByIdForOwner(id, user.id);
		return Response.json({ mcq });
	} catch (error) {
		return handleMcqError(error);
	}
}

export async function PUT(request: Request, context: RouteContext) {
	const user = await getCurrentUser();
	if (!user) {
		return jsonError(401, "Not authenticated");
	}
	try {
		const { id } = await context.params;
		const body = await readJsonBody(request);
		parseMcqUpdateBody(body);
		const mcq = await mcqService.update(id, user.id, body);
		return Response.json({ mcq });
	} catch (error) {
		return handleMcqError(error);
	}
}

export async function DELETE(_request: Request, context: RouteContext) {
	const user = await getCurrentUser();
	if (!user) {
		return jsonError(401, "Not authenticated");
	}
	try {
		const { id } = await context.params;
		await mcqService.delete(id, user.id);
		return new Response(null, { status: 204 });
	} catch (error) {
		return handleMcqError(error);
	}
}
