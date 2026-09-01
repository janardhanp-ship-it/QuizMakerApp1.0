import { notFound, redirect } from "next/navigation";

import { AppHeader } from "@/components/auth/app-header";
import { McqForm } from "@/components/mcqs/mcq-form";
import { getCurrentUser } from "@/lib/auth/session";
import { McqForbiddenError, McqNotFoundError } from "@/lib/mcqs/errors";
import { mcqService } from "@/lib/mcqs/mcq-service";

export const dynamic = "force-dynamic";

export default async function EditMcqPage({ params }: { params: Promise<{ id: string }> }) {
	const user = await getCurrentUser();
	const { id } = await params;
	if (!user) {
		redirect(`/login?next=/quizzes/${id}/edit`);
	}

	let mcq;
	try {
		mcq = await mcqService.getByIdForOwner(id, user.id);
	} catch (error) {
		if (error instanceof McqForbiddenError) {
			redirect("/quizzes");
		}
		if (error instanceof McqNotFoundError) {
			notFound();
		}
		throw error;
	}

	return (
		<div className="min-h-screen bg-background">
			<AppHeader user={user} />
			<main className="mx-auto w-full max-w-3xl px-4 py-10">
				<McqForm mode="edit" mcq={mcq} />
			</main>
		</div>
	);
}
