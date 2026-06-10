import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { aiSlopEngine } from "../src/engines/ai-slop/index.js";
import type { EngineContext } from "../src/engines/types.js";

// Regression: scanning generated Lua data files (e.g. game FX tables with
// hundreds of thousands of global assignments) produced enough diagnostics
// that `diagnostics.push(...result.value)` exceeded the V8 argument limit
// and the whole engine was skipped with "Maximum call stack size exceeded".

let tmpDir: string;

const makeContext = (files: string[]): EngineContext => ({
	rootDirectory: tmpDir,
	languages: ["lua"],
	frameworks: ["none"],
	files,
	installedTools: {},
	config: {
		quality: {
			maxFunctionLoc: 80,
			maxFileLoc: 400,
			maxNesting: 4,
			maxParams: 6,
		},
		security: { audit: true, auditTimeout: 25000 },
	},
});

beforeEach(() => {
	tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aislop-large-volume-"));
});

afterEach(() => {
	fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("aiSlopEngine with very large diagnostic volumes", () => {
	it("survives a file that yields hundreds of thousands of diagnostics", async () => {
		const lineCount = 300_000;
		const content = Array.from({ length: lineCount }, (_, i) => `g${i} = ${i}`).join("\n");
		const filePath = path.join(tmpDir, "huge.lua");
		fs.writeFileSync(filePath, content, "utf-8");

		const result = await aiSlopEngine.run(makeContext([filePath]));

		expect(result.skipped).toBe(false);
		expect(result.diagnostics.length).toBeGreaterThanOrEqual(lineCount);
	}, 60_000);
});
