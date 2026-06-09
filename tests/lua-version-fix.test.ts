import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { detectLuaPatterns } from "../src/engines/ai-slop/lua-patterns.js";
import { fixLuaPatterns } from "../src/engines/ai-slop/lua-patterns-fix.js";
import type { EngineContext } from "../src/engines/types.js";

const makeContext = (rootDirectory: string): EngineContext => ({
	rootDirectory,
	languages: ["lua"],
	frameworks: ["none"],
	installedTools: {},
	config: {
		quality: { maxFunctionLoc: 80, maxFileLoc: 400, maxNesting: 4, maxParams: 6 },
		security: { audit: false, auditTimeout: 60 },
		lint: { typecheck: false },
	},
});

describe("Lua version auto-fixes", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aislop-lua-fix-"));
	});

	afterEach(() => {
		fs.rmSync(tmpDir, { recursive: true, force: true });
	});

	const writeLua = (name: string, content: string) => {
		fs.writeFileSync(path.join(tmpDir, name), content, "utf-8");
	};

	const readLua = (name: string): string => fs.readFileSync(path.join(tmpDir, name), "utf-8");

	it("fixes floor division on Lua 5.2 target", async () => {
		fs.writeFileSync(path.join(tmpDir, "stylua.toml"), 'syntax = "Lua52"\n');
		writeLua("math.lua", "local n = width // 2\n");
		await fixLuaPatterns(makeContext(tmpDir));
		expect(readLua("math.lua")).toContain("math.floor(width / 2)");
	});

	it("fixes bitwise operators to bit32 on Lua 5.2 target", async () => {
		fs.writeFileSync(path.join(tmpDir, "stylua.toml"), 'syntax = "Lua52"\n');
		writeLua("bits.lua", "local x = flags & mask\n");
		await fixLuaPatterns(makeContext(tmpDir));
		expect(readLua("bits.lua")).toContain("bit32.band(flags, mask)");
	});

	it("fixes const and close attributes on Lua 5.3 target", async () => {
		fs.writeFileSync(path.join(tmpDir, ".luarc.json"), JSON.stringify({ runtime: { version: "5.3" } }));
		writeLua("state.lua", "local const count = 1\nlocal f <close> = io.open('x')\n");
		await fixLuaPatterns(makeContext(tmpDir));
		const content = readLua("state.lua");
		expect(content).toContain("local count = 1");
		expect(content).not.toContain("<close>");
	});

	it("fixes loadstring to load on Lua 5.4 target", async () => {
		fs.writeFileSync(path.join(tmpDir, "stylua.toml"), 'syntax = "Lua54"\n');
		writeLua("dyn.lua", "local fn = loadstring('return 1')\n");
		await fixLuaPatterns(makeContext(tmpDir));
		expect(readLua("dyn.lua")).toContain("load('return 1')");
		expect(readLua("dyn.lua")).not.toContain("loadstring");
	});

	it("fixes bit32 to native operators on Lua 5.4 target", async () => {
		fs.writeFileSync(path.join(tmpDir, "stylua.toml"), 'syntax = "Lua54"\n');
		writeLua("bits.lua", "local x = bit32.band(flags, mask)\n");
		await fixLuaPatterns(makeContext(tmpDir));
		expect(readLua("bits.lua")).toContain("(flags & mask)");
	});

	it("fixes global unpack to table.unpack on Lua 5.4 target", async () => {
		fs.writeFileSync(path.join(tmpDir, "stylua.toml"), 'syntax = "Lua54"\n');
		writeLua("args.lua", "return unpack(items)\n");
		await fixLuaPatterns(makeContext(tmpDir));
		expect(readLua("args.lua")).toContain("table.unpack(items)");
	});

	it("fixes table.unpack to unpack on Lua 5.1 target", async () => {
		fs.writeFileSync(path.join(tmpDir, "stylua.toml"), 'syntax = "Lua51"\n');
		writeLua("args.lua", "return table.unpack(items)\n");
		await fixLuaPatterns(makeContext(tmpDir));
		expect(readLua("args.lua")).toContain("unpack(items)");
	});

	it("fixes math helpers on Lua 5.4 target", async () => {
		fs.writeFileSync(path.join(tmpDir, "stylua.toml"), 'syntax = "Lua54"\n');
		writeLua(
			"math.lua",
			"local a = math.atan2(y, x)\nlocal b = math.pow(2, 8)\nlocal c = math.mod(10, 3)\n",
		);
		await fixLuaPatterns(makeContext(tmpDir));
		const content = readLua("math.lua");
		expect(content).toContain("math.atan(y, x)");
		expect(content).toContain("(2 ^ 8)");
		expect(content).toContain("(10 % 3)");
	});

	it("fixes global assignments to local", async () => {
		writeLua("globals.lua", "counter = 0\n");
		await fixLuaPatterns(makeContext(tmpDir));
		expect(readLua("globals.lua")).toBe("local counter = 0\n");
	});

	it("marks fixable diagnostics for auto-fixable version rules", async () => {
		fs.writeFileSync(path.join(tmpDir, "stylua.toml"), 'syntax = "Lua52"\n');
		writeLua("mix.lua", "local n = a // b\n");
		const diagnostics = await detectLuaPatterns(makeContext(tmpDir));
		const rule = diagnostics.find((d) => d.rule === "ai-slop/lua-version-integer-division");
		expect(rule?.fixable).toBe(true);
	});

	it("flags but does not auto-fix goto on old targets", async () => {
		fs.writeFileSync(path.join(tmpDir, "stylua.toml"), 'syntax = "Lua51"\n');
		writeLua("flow.lua", "goto skip\n");
		const diagnostics = await detectLuaPatterns(makeContext(tmpDir));
		const rule = diagnostics.find((d) => d.rule === "ai-slop/lua-version-goto");
		expect(rule?.fixable).toBe(false);
	});

	it("fixes legacy string and table APIs on Lua 5.4 target", async () => {
		fs.writeFileSync(path.join(tmpDir, "stylua.toml"), 'syntax = "Lua54"\n');
		writeLua(
			"legacy.lua",
			"for word in string.gfind(line, '%w+') do end\nlocal n = table.getn(items)\ntable.setn(items, 0)\n",
		);
		await fixLuaPatterns(makeContext(tmpDir));
		const content = readLua("legacy.lua");
		expect(content).toContain("string.gmatch(line, '%w+')");
		expect(content).toContain("#(items)");
		expect(content).not.toContain("table.setn");
	});

	it("fixes package loaders rename on Lua 5.4 target", async () => {
		fs.writeFileSync(path.join(tmpDir, "stylua.toml"), 'syntax = "Lua54"\n');
		writeLua("loader.lua", "local loaders = package.loaders\n");
		await fixLuaPatterns(makeContext(tmpDir));
		expect(readLua("loader.lua")).toContain("package.searchers");
	});

	it("fixes package.searchers down to loaders on Lua 5.1 target", async () => {
		fs.writeFileSync(path.join(tmpDir, "stylua.toml"), 'syntax = "Lua51"\n');
		writeLua("loader.lua", "local loaders = package.searchers\n");
		await fixLuaPatterns(makeContext(tmpDir));
		expect(readLua("loader.lua")).toContain("package.loaders");
	});

	it("fixes removed math helpers on Lua 5.4 target", async () => {
		fs.writeFileSync(path.join(tmpDir, "stylua.toml"), 'syntax = "Lua54"\n');
		writeLua("math.lua", "local x = math.log10(100)\nlocal y = math.ldexp(1.5, 3)\n");
		await fixLuaPatterns(makeContext(tmpDir));
		const content = readLua("math.lua");
		expect(content).toContain("math.log(100, 10)");
		expect(content).toContain("(1.5 * 2.0 ^ 3)");
	});

	it("fixes loadlib on Lua 5.4 target", async () => {
		fs.writeFileSync(path.join(tmpDir, "stylua.toml"), 'syntax = "Lua54"\n');
		writeLua("cmod.lua", "local lib = loadlib('foo.so', 'init')\n");
		await fixLuaPatterns(makeContext(tmpDir));
		expect(readLua("cmod.lua")).toContain("package.loadlib('foo.so', 'init')");
	});
});
