import Link from "next/link";

import { LogoutButton } from "@/components/auth/logout-button";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/session";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function Home() {
	const user = await getCurrentUser();

	return (
		<main className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center gap-6 px-6 py-16">
			<div>
				<h1 className="font-heading text-2xl font-medium">Quiz Maker</h1>
				<p className="mt-2 text-muted-foreground">
					Register or log in to take multiple-choice quizzes.
				</p>
			</div>
			{user ? (
				<div className="flex flex-col gap-3">
					<p className="text-sm text-muted-foreground">
						Signed in as {user.firstName} {user.lastName}.
					</p>
					<div className="flex flex-wrap gap-2">
						<Link href="/quizzes" className={cn(buttonVariants())}>
							Go to quizzes
						</Link>
						<LogoutButton />
					</div>
				</div>
			) : (
				<div className="flex flex-wrap gap-2">
					<Link href="/register" className={cn(buttonVariants())}>
						Register
					</Link>
					<Link href="/login" className={cn(buttonVariants({ variant: "outline" }))}>
						Log in
					</Link>
				</div>
			)}
		</main>
	);
}
