await Deno.remove("dist", { recursive: true }).catch(console.error);
// @ts-expect-error no types yet
await Deno.bundle({
	entrypoints: ["./src/Task.ts"],
	outputDir: "dist",
	platform: "browser",
	minify: true,
}).catch(console.error);
// @ts-expect-error no types yet
await Deno.bundle({
	entrypoints: ["./polyfill/Task.ts"],
	outputDir: "dist/polyfill",
	platform: "browser",
	minify: true,
}).catch(console.error);
