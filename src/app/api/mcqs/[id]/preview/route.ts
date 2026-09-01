import { jsonError } from "@/lib/auth/http";
import { getCurrentUser } from "@/lib/auth/session";
import { handleMcqError } from "@/lib/mcqs/http";
import { mcqService } from "@/lib/mcqs/mcq-service";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
	const user = await getCurrentUser();
	if (!user) {
		return jsonError(401, "Not authenticated");
	}
	try {
		const { id } = await context.params;
		const mcq = await mcqService.getPreview(id);
		return Response.json({ mcq });
	} catch (error) {
		return handleMcqError(error);
	}
}
