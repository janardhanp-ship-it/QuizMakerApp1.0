import { redirect } from "next/navigation";

import { AppHeader } from "@/components/auth/app-header";
import { McqList } from "@/components/mcqs/mcq-list";
import { getCurrentUser } from "@/lib/auth/session";
import { mcqService } from "@/lib/mcqs/mcq-service";

export const dynamic = "force-dynamic";

export default async function QuizzesPage() {
	const user = await getCurrentUser();
	if (!user) {
		redirect("/login?next=/quizzes");
	}

	const mcqs = await mcqService.list(user.id);

	return (
		<div className="min-h-screen bg-background">
			<AppHeader user={user} />
			<main className="mx-auto w-full max-w-5xl px-4 py-10">
				<p className="mb-6 text-muted-foreground">
					Signed in as {user.firstName} {user.lastName} (@{user.username}).
				</p>
				<McqList items={mcqs} />
			</main>
		</div>
	);
}
