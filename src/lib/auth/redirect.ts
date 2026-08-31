export function safeNextPath(value: string | null | undefined): string {
	if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
		return "/quizzes";
	}
	return value;
}
