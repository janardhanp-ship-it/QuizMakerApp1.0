import { redirect } from "next/navigation";

import { RegisterForm } from "@/components/auth/register-form";
import { getCurrentUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
	const user = await getCurrentUser();
	if (user) {
		redirect("/quizzes");
	}

	return (
		<main className="flex min-h-screen items-center justify-center bg-background p-6">
			<RegisterForm />
		</main>
	);
}
