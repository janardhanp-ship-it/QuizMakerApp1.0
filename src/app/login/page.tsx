import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/login-form";
import { getCurrentUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function LoginPage({
	searchParams,
}: {
	searchParams: Promise<{ next?: string }>;
}) {
	const user = await getCurrentUser();
	if (user) {
		redirect("/quizzes");
	}
	const { next } = await searchParams;

	return (
		<main className="flex min-h-screen items-center justify-center bg-background p-6">
			<LoginForm nextPath={next} />
		</main>
	);
}
