import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	// Use cwd, not __dirname: Next bundles this file, so __dirname can be a temp
	// folder with no `src/app`, which makes every route 404 in `next dev`.
	turbopack: {
		root: path.resolve(process.cwd()),
	},
};

export default nextConfig;

// Enable calling `getCloudflareContext()` in `next dev`.
// See https://opennext.js.org/cloudflare/bindings#local-access-to-bindings.
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
