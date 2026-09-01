import { redirect } from "next/navigation";

import { AppHeader } from "@/components/auth/app-header";
import { McqForm } from "@/components/mcqs/mcq-form";
import { getCurrentUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function NewMcqPage() {
	const user = await getCurrentUser();
	if (!user) {
		redirect("/login?next=/quizzes/new");
	}

	return (
		<div className="min-h-screen bg-background">
			<AppHeader user={user} />
			<main className="mx-auto w-full max-w-3xl px-4 py-10">
				<McqForm mode="create" />
			</main>
		</div>
	);
}
