export class McqNotFoundError extends Error {
	constructor(message = "Question not found") {
		super(message);
		this.name = "McqNotFoundError";
	}
}

export class McqForbiddenError extends Error {
	constructor(message = "You cannot change this question") {
		super(message);
		this.name = "McqForbiddenError";
	}
}

export class AttemptsExistError extends Error {
	constructor(message = "Cannot edit choices after attempts exist") {
		super(message);
		this.name = "AttemptsExistError";
	}
}

export { ValidationError } from "@/lib/users/errors";
