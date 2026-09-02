import { notFound, redirect } from "next/navigation";

import { AppHeader } from "@/components/auth/app-header";
import { McqPreview } from "@/components/mcqs/mcq-preview";
import { getCurrentUser } from "@/lib/auth/session";
import { McqNotFoundError } from "@/lib/mcqs/errors";
import { mcqService } from "@/lib/mcqs/mcq-service";

export const dynamic = "force-dynamic";

export default async function PreviewMcqPage({ params }: { params: Promise<{ id: string }> }) {
	const user = await getCurrentUser();
	if (!user) {
		redirect("/login?next=/quizzes");
	}

	const { id } = await params;
	let mcq;
	try {
		mcq = await mcqService.getPreview(id);
	} catch (error) {
		if (error instanceof McqNotFoundError) {
			notFound();
		}
		throw error;
	}

	return (
		<div className="min-h-screen bg-background">
			<AppHeader user={user} />
			<main className="mx-auto w-full max-w-3xl px-4 py-10">
				<McqPreview mcq={mcq} />
			</main>
		</div>
	);
}
