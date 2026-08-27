import type { UserRow } from "@/lib/users/types";

type SessionRow = {
	id: string;
	user_id: string;
	token_hash: string;
	expires_at: string;
	created_at: string;
};

function normalizeSql(sql: string): string {
	return sql.replace(/\s+/g, " ").trim();
}

export function createFakeD1() {
	const users: UserRow[] = [];
	const sessions: SessionRow[] = [];

	return {
		users,
		sessions,
		prepare(sql: string) {
			const normalized = normalizeSql(sql);
			return {
				bind(...params: unknown[]) {
					return {
						async all<T>() {
							if (normalized.includes("FROM users WHERE id =")) {
								const row = users.find((user) => user.id === params[0]);
								return { results: row ? [row as T] : [] };
							}
							if (normalized.includes("FROM users WHERE username =")) {
								const row = users.find((user) => user.username === params[0]);
								return { results: row ? [row as T] : [] };
							}
							if (normalized.includes("FROM users WHERE email =")) {
								const row = users.find((user) => user.email === params[0]);
								return { results: row ? [row as T] : [] };
							}
							if (normalized.includes("FROM sessions") && normalized.includes("token_hash")) {
								const now = String(params[1] ?? "");
								const row = sessions.find(
									(session) => session.token_hash === params[0] && session.expires_at > now,
								);
								return { results: row ? [row as T] : [] };
							}
							return { results: [] as T[] };
						},
						async run() {
							if (normalized.startsWith("INSERT INTO users")) {
								const username = String(params[3]);
								const email = String(params[4]);
								if (users.some((user) => user.username === username)) {
									throw new Error("UNIQUE constraint failed: users.username");
								}
								if (users.some((user) => user.email === email)) {
									throw new Error("UNIQUE constraint failed: users.email");
								}
								users.push({
									id: String(params[0]),
									first_name: String(params[1]),
									last_name: String(params[2]),
									username,
									email,
									password_hash: String(params[5]),
								});
								return { meta: { changes: 1 } };
							}
							if (normalized.startsWith("UPDATE users")) {
								const id = String(params[6]);
								const username = String(params[2]);
								const email = String(params[3]);
								const index = users.findIndex((user) => user.id === id);
								if (index < 0) {
									return { meta: { changes: 0 } };
								}
								if (users.some((user) => user.username === username && user.id !== id)) {
									throw new Error("UNIQUE constraint failed: users.username");
								}
								if (users.some((user) => user.email === email && user.id !== id)) {
									throw new Error("UNIQUE constraint failed: users.email");
								}
								users[index] = {
									id,
									first_name: String(params[0]),
									last_name: String(params[1]),
									username,
									email,
									password_hash: String(params[4]),
								};
								return { meta: { changes: 1 } };
							}
							if (normalized.startsWith("INSERT INTO sessions")) {
								sessions.push({
									id: String(params[0]),
									user_id: String(params[1]),
									token_hash: String(params[2]),
									expires_at: String(params[3]),
									created_at: String(params[4]),
								});
								return { meta: { changes: 1 } };
							}
							if (normalized.startsWith("DELETE FROM sessions WHERE user_id")) {
								const before = sessions.length;
								const remaining = sessions.filter((session) => session.user_id !== params[0]);
								sessions.splice(0, sessions.length, ...remaining);
								return { meta: { changes: before - sessions.length } };
							}
							if (normalized.startsWith("DELETE FROM sessions WHERE token_hash")) {
								const before = sessions.length;
								const remaining = sessions.filter((session) => session.token_hash !== params[0]);
								sessions.splice(0, sessions.length, ...remaining);
								return { meta: { changes: before - sessions.length } };
							}
							if (normalized.startsWith("DELETE FROM users")) {
								const index = users.findIndex((user) => user.id === params[0]);
								if (index < 0) {
									return { meta: { changes: 0 } };
								}
								users.splice(index, 1);
								return { meta: { changes: 1 } };
							}
							return { meta: { changes: 0 } };
						},
					};
				},
			};
		},
	};
}
