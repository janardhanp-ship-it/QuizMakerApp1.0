import { redirect } from "next/navigation";

import { LoginForm } from "@/components/login-form";
import { getCurrentUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function Page({
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
		<div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
			<div className="w-full max-w-sm">
				<LoginForm nextPath={next} />
			</div>
		</div>
	);
}
