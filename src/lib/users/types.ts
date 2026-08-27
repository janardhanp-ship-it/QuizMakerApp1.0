export type PublicUser = {
	id: string;
	firstName: string;
	lastName: string;
	username: string;
	email: string;
};

export type UserRecord = PublicUser & {
	passwordHash: string;
};

export type UserRow = {
	id: string;
	first_name: string;
	last_name: string;
	username: string;
	email: string;
	password_hash: string;
};

export type CreateUserInput = {
	firstName: string;
	lastName: string;
	username: string;
	email: string;
	password: string;
};

export type UpdateUserInput = {
	firstName?: string;
	lastName?: string;
	username?: string;
	email?: string;
	password?: string;
};
