import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	compareLuaVersions,
	LUA_VERSIONS,
	luaVersionAtLeast,
	parseLuaVersion,
	styluaSyntaxFor,
	SUPPORTED_LUA_VERSIONS,
} from "../src/lua/versions.js";
import { detectLuaVersion, resolveLuaVersion } from "../src/utils/lua-version.js";

describe("lua versions registry", () => {
	it("covers Lua 5.0 through 5.5", () => {
		expect(SUPPORTED_LUA_VERSIONS).toEqual(["5.0", "5.1", "5.2", "5.3", "5.4", "5.5"]);
		expect(LUA_VERSIONS).toHaveLength(6);
	});

	it("orders versions correctly", () => {
		expect(compareLuaVersions("5.0", "5.5")).toBeLessThan(0);
		expect(compareLuaVersions("5.5", "5.0")).toBeGreaterThan(0);
		expect(luaVersionAtLeast("5.4", "5.3")).toBe(true);
		expect(luaVersionAtLeast("5.1", "5.2")).toBe(false);
	});

	it("parses common version strings", () => {
		expect(parseLuaVersion("5.4")).toBe("5.4");
		expect(parseLuaVersion("Lua 5.1")).toBe("5.1");
		expect(parseLuaVersion("5.4.8")).toBe("5.4");
		expect(parseLuaVersion("lua54")).toBe("5.4");
	});

	it("maps stylua syntax for all supported versions", () => {
		expect(styluaSyntaxFor("5.0")).toBe("lua51");
		expect(styluaSyntaxFor("5.1")).toBe("lua51");
		expect(styluaSyntaxFor("5.5")).toBe("lua54");
	});
});

describe("detectLuaVersion", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aislop-lua-version-"));
	});

	afterEach(() => {
		fs.rmSync(tmpDir, { recursive: true, force: true });
	});

	it("reads .luarc.json runtime.version", () => {
		fs.writeFileSync(
			path.join(tmpDir, ".luarc.json"),
			JSON.stringify({ runtime: { version: "Lua 5.3" } }),
		);
		expect(detectLuaVersion(tmpDir)).toEqual({ version: "5.3", source: ".luarc.json" });
	});

	it("reads stylua.toml syntax", () => {
		fs.writeFileSync(path.join(tmpDir, "stylua.toml"), 'syntax = "Lua52"\n');
		expect(detectLuaVersion(tmpDir)).toEqual({ version: "5.2", source: "stylua.toml" });
	});

	it("reads selene.toml std", () => {
		fs.writeFileSync(path.join(tmpDir, "selene.toml"), 'std = "lua54"\n');
		expect(detectLuaVersion(tmpDir)).toEqual({ version: "5.4", source: "selene.toml" });
	});

	it("reads .rockspec lua dependency", () => {
		fs.writeFileSync(
			path.join(tmpDir, "mylib-1.0-1.rockspec"),
			'dependencies = { "lua >= 5.1" }\n',
		);
		expect(detectLuaVersion(tmpDir)).toEqual({ version: "5.1", source: ".rockspec" });
	});

	it("defaults to 5.4 when no config is present", () => {
		expect(resolveLuaVersion(tmpDir)).toBe("5.4");
		expect(detectLuaVersion(tmpDir)).toEqual({ version: null, source: null });
	});
});
