import { describe, expect, it } from "vitest";
import {
	applyLuacheckFixes,
	isLuacheckFixable,
} from "../src/engines/lint/luacheck-fix.js";
import type { Diagnostic } from "../src/engines/types.js";

const diag = (
	rule: string,
	line: number,
	message: string,
): Diagnostic => ({
	filePath: "sample.lua",
	engine: "lint",
	rule,
	severity: "warning",
	message,
	help: "",
	line,
	column: 1,
	category: "Lua Lint",
	fixable: true,
});

describe("isLuacheckFixable", () => {
	it("marks known fixable codes", () => {
		expect(isLuacheckFixable("211")).toBe(true);
		expect(isLuacheckFixable("W511")).toBe(true);
		expect(isLuacheckFixable("561")).toBe(false);
	});
});

describe("applyLuacheckFixes", () => {
	it("prefixes unused locals like oxlint unused-var fixes", () => {
		const source = "local count = 1\n";
		const { content, changed } = applyLuacheckFixes(source, [
			diag("luacheck/211", 1, "unused local variable 'count'"),
		]);
		expect(changed).toBe(true);
		expect(content).toBe("local _count = 1\n");
	});

	it("prefixes unused function arguments", () => {
		const source = "function greet(name)\n  return 'hi'\nend\n";
		const { content } = applyLuacheckFixes(source, [
			diag("luacheck/212", 1, "unused argument 'name'"),
		]);
		expect(content).toContain("function greet(_name)");
	});

	it("adds local to undefined global assignments", () => {
		const source = "counter = 0\n";
		const { content } = applyLuacheckFixes(source, [
			diag("luacheck/111", 1, "setting non-standard global variable 'counter'"),
		]);
		expect(content).toBe("local counter = 0\n");
	});

	it("removes unused global assignments", () => {
		const source = "scratch = 1\nprint('ok')\n";
		const { content } = applyLuacheckFixes(source, [
			diag("luacheck/131", 1, "unused global variable 'scratch'"),
		]);
		expect(content).toBe("print('ok')\n");
	});

	it("removes unreachable code lines", () => {
		const source = "return 1\nprint('never')\n";
		const { content } = applyLuacheckFixes(source, [
			diag("luacheck/511", 2, "unreachable code"),
		]);
		expect(content).toBe("return 1\n");
	});

	it("removes unused labels", () => {
		const source = "::skip::\nprint('ok')\n";
		const { content } = applyLuacheckFixes(source, [
			diag("luacheck/521", 1, "unused label 'skip'"),
		]);
		expect(content).toBe("print('ok')\n");
	});

	it("removes empty do blocks and empty if branches", () => {
		const source = "do end\nif true then end\n";
		const { content } = applyLuacheckFixes(source, [
			diag("luacheck/541", 1, "empty do end block"),
			diag("luacheck/542", 2, "empty if branch"),
		]);
		expect(content).toBe("");
	});

	it("flips negated relational operators", () => {
		const source = "if not a == b then end\n";
		const { content } = applyLuacheckFixes(source, [
			diag("luacheck/581", 1, "negation of relational operator"),
		]);
		expect(content).toBe("if a ~= b then end\n");
	});

	it("removes empty statements and whitespace-only lines", () => {
		const source = ";\n   \nlocal x = 1\n";
		const { content } = applyLuacheckFixes(source, [
			diag("luacheck/551", 1, "empty statement"),
			diag("luacheck/611", 2, "line contains only whitespace"),
		]);
		expect(content).toBe("local x = 1\n");
	});

	it("trims trailing whitespace in code and comments", () => {
		const source = "local x = 1   \n-- note   \n";
		const { content } = applyLuacheckFixes(source, [
			diag("luacheck/612", 1, "trailing whitespace"),
			diag("luacheck/614", 2, "trailing whitespace in a comment"),
		]);
		expect(content).toBe("local x = 1\n-- note\n");
	});
});
