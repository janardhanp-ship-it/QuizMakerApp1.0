const PBKDF2_ALGORITHM = "pbkdf2-sha256";
const PBKDF2_ITERATIONS = 310_000;
const HASH_BITS = 256;
const SALT_BYTES = 16;

function bytesToHex(bytes: Uint8Array): string {
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex: string): Uint8Array {
	if (hex.length % 2 !== 0) {
		throw new Error("Invalid hex string");
	}
	const bytes = new Uint8Array(hex.length / 2);
	for (let i = 0; i < bytes.length; i++) {
		bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
	}
	return bytes;
}

function timingSafeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) {
		return false;
	}
	const left = new TextEncoder().encode(a);
	const right = new TextEncoder().encode(b);
	let diff = 0;
	for (let i = 0; i < left.length; i++) {
		diff |= left[i]! ^ right[i]!;
	}
	return diff === 0;
}

async function deriveBits(password: string, salt: Uint8Array, iterations: number): Promise<string> {
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(password),
		"PBKDF2",
		false,
		["deriveBits"],
	);
	const bits = await crypto.subtle.deriveBits(
		{
			name: "PBKDF2",
			hash: "SHA-256",
			salt: salt as BufferSource,
			iterations,
		},
		key,
		HASH_BITS,
	);
	return bytesToHex(new Uint8Array(bits));
}

export async function hashPassword(password: string): Promise<string> {
	const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
	const hash = await deriveBits(password, salt, PBKDF2_ITERATIONS);
	return `${PBKDF2_ALGORITHM}:${PBKDF2_ITERATIONS}:${bytesToHex(salt)}:${hash}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
	const parts = storedHash.split(":");
	if (parts.length !== 4) {
		return false;
	}
	const [algorithm, iterationText, saltHex, expectedHash] = parts;
	if (algorithm !== PBKDF2_ALGORITHM || !iterationText || !saltHex || !expectedHash) {
		return false;
	}
	const iterations = Number.parseInt(iterationText, 10);
	if (!Number.isFinite(iterations) || iterations < 1) {
		return false;
	}
	try {
		const actualHash = await deriveBits(password, hexToBytes(saltHex), iterations);
		return timingSafeEqual(actualHash, expectedHash);
	} catch {
		return false;
	}
}
