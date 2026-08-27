import { redirect } from "next/navigation";

import { AppHeader } from "@/components/auth/app-header";
import { getCurrentUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function QuizzesPage() {
	const user = await getCurrentUser();
	if (!user) {
		redirect("/login?next=/quizzes");
	}

	return (
		<div className="min-h-screen bg-background">
			<AppHeader user={user} />
			<main className="mx-auto w-full max-w-3xl px-4 py-10">
				<h1 className="font-heading text-2xl font-medium">Quizzes</h1>
				<p className="mt-2 text-muted-foreground">
					Signed in as {user.firstName} {user.lastName} (@{user.username}).
				</p>
				<p className="mt-4 text-muted-foreground">
					MCQ quizzes will appear here. This page is a placeholder until the quiz feature is
					built.
				</p>
			</main>
		</div>
	);
}
