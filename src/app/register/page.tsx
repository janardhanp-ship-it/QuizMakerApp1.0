import { redirect } from "next/navigation";

import { SignupForm } from "@/components/signup-form";
import { getCurrentUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function Page() {
	const user = await getCurrentUser();
	if (user) {
		redirect("/quizzes");
	}

	return (
		<div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
			<div className="w-full max-w-sm">
				<SignupForm />
			</div>
		</div>
	);
}
