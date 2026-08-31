import { UniqueConstraintError, ValidationError } from "@/lib/users/errors";

export function jsonError(status: number, error: string, fields?: Record<string, string>) {
	return Response.json(fields ? { error, fields } : { error }, { status });
}

export function handleAuthError(error: unknown): Response {
	if (error instanceof ValidationError) {
		return jsonError(400, error.message, error.fields);
	}
	if (error instanceof UniqueConstraintError) {
		const fields =
			error.field === "unknown" ? undefined : { [error.field]: error.message };
		return jsonError(409, error.message, fields);
	}
	console.error(error);
	return jsonError(500, "Something went wrong");
}

export async function readJsonBody(request: Request): Promise<unknown> {
	try {
		return await request.json();
	} catch {
		throw new ValidationError({ form: "Invalid JSON body" });
	}
}
