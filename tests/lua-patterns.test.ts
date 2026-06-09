import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { detectLuaPatterns } from "../src/engines/ai-slop/lua-patterns.js";
import type { EngineContext } from "../src/engines/types.js";

const makeContext = (rootDirectory: string): EngineContext => ({
	rootDirectory,
	languages: ["lua"],
	frameworks: ["none"],
	installedTools: {},
	config: {
		quality: { complexity: { maxFunctionLines: 80, maxNestingDepth: 4, maxParams: 6 } },
		security: { audit: false },
		lint: { typecheck: false },
	},
});

describe("detectLuaPatterns", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aislop-lua-patterns-"));
	});

	afterEach(() => {
		fs.rmSync(tmpDir, { recursive: true, force: true });
	});

	const writeLua = (name: string, content: string) => {
		fs.writeFileSync(path.join(tmpDir, name), content, "utf-8");
	};

	it("flags print() debug output", async () => {
		writeLua("util.lua", "local function run()\n  print('debug')\nend\n");
		const diagnostics = await detectLuaPatterns(makeContext(tmpDir));
		expect(diagnostics.some((d) => d.rule === "ai-slop/lua-print-debug")).toBe(true);
	});

	it("flags global assignment", async () => {
		writeLua("util.lua", "counter = 0\n");
		const diagnostics = await detectLuaPatterns(makeContext(tmpDir));
		expect(diagnostics.some((d) => d.rule === "ai-slop/lua-global-assign")).toBe(true);
	});

	it("flags goto on Lua 5.1 target", async () => {
		fs.writeFileSync(path.join(tmpDir, "stylua.toml"), 'syntax = "Lua51"\n');
		writeLua("flow.lua", "goto skip\n::skip::\n");
		const diagnostics = await detectLuaPatterns(makeContext(tmpDir));
		expect(diagnostics.some((d) => d.rule === "ai-slop/lua-version-goto")).toBe(true);
		expect(diagnostics.some((d) => d.rule === "ai-slop/lua-version-label")).toBe(true);
	});

	it("allows goto on Lua 5.2 target", async () => {
		fs.writeFileSync(path.join(tmpDir, "stylua.toml"), 'syntax = "Lua52"\n');
		writeLua("flow.lua", "goto skip\n::skip::\n");
		const diagnostics = await detectLuaPatterns(makeContext(tmpDir));
		expect(diagnostics.some((d) => d.rule.startsWith("ai-slop/lua-version-"))).toBe(false);
	});

	it("flags bitwise operators on Lua 5.2 target", async () => {
		fs.writeFileSync(path.join(tmpDir, "stylua.toml"), 'syntax = "Lua52"\n');
		writeLua("bits.lua", "local x = a & 3\n");
		const diagnostics = await detectLuaPatterns(makeContext(tmpDir));
		expect(diagnostics.some((d) => d.rule === "ai-slop/lua-version-bitwise")).toBe(true);
	});

	it("flags declare on Lua 5.4 target", async () => {
		fs.writeFileSync(path.join(tmpDir, ".luarc.json"), JSON.stringify({ runtime: { version: "5.4" } }));
		writeLua("globals.lua", "declare global_name\n");
		const diagnostics = await detectLuaPatterns(makeContext(tmpDir));
		expect(diagnostics.some((d) => d.rule === "ai-slop/lua-version-declare")).toBe(true);
	});

	it("skips test files", async () => {
		writeLua("test_util.lua", "print('debug')\n");
		const diagnostics = await detectLuaPatterns(makeContext(tmpDir));
		expect(diagnostics).toHaveLength(0);
	});

	it("flags table.foreach on Lua 5.4 target", async () => {
		fs.writeFileSync(path.join(tmpDir, "stylua.toml"), 'syntax = "Lua54"\n');
		writeLua("iter.lua", "table.foreach(t, function(k, v) end)\n");
		const diagnostics = await detectLuaPatterns(makeContext(tmpDir));
		expect(diagnostics.some((d) => d.rule === "ai-slop/lua-version-table-foreach")).toBe(true);
	});

	it("flags math.frexp on Lua 5.4 target", async () => {
		fs.writeFileSync(path.join(tmpDir, "stylua.toml"), 'syntax = "Lua54"\n');
		writeLua("float.lua", "local m, e = math.frexp(x)\n");
		const diagnostics = await detectLuaPatterns(makeContext(tmpDir));
		expect(diagnostics.some((d) => d.rule === "ai-slop/lua-version-math-frexp")).toBe(true);
	});
});
