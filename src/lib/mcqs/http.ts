import { jsonError } from "@/lib/auth/http";
import { AttemptsExistError, McqForbiddenError, McqNotFoundError } from "@/lib/mcqs/errors";
import { ValidationError } from "@/lib/users/errors";

export function handleMcqError(error: unknown): Response {
	if (error instanceof ValidationError) {
		return jsonError(400, error.message, error.fields);
	}
	if (error instanceof McqForbiddenError) {
		return jsonError(403, error.message);
	}
	if (error instanceof McqNotFoundError) {
		return jsonError(404, error.message);
	}
	if (error instanceof AttemptsExistError) {
		return jsonError(409, error.message);
	}
	console.error(error);
	return jsonError(500, "Something went wrong");
}
