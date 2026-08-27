import Link from "next/link";

import { LogoutButton } from "@/components/auth/logout-button";
import type { PublicUser } from "@/lib/users/types";

export function AppHeader({ user }: { user: PublicUser }) {
	return (
		<header className="border-b bg-background">
			<div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-4 py-3">
				<Link href="/" className="font-medium">
					Quiz Maker
				</Link>
				<div className="flex items-center gap-3 text-sm text-muted-foreground">
					<span>
						{user.firstName} {user.lastName}
					</span>
					<LogoutButton />
				</div>
			</div>
		</header>
	);
}
