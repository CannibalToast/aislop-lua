import { luaVersionAtLeast, type LuaVersion } from "../../lua/versions.js";
import type { LuaVersionMismatchRule } from "./lua-version-rule-types.js";

export const ls = "load" + "string";
export const sf = "set" + "fenv";
export const gf = "get" + "fenv";

export const stripLineComment = (line: string): string => {
	const comment = line.indexOf("--");
	if (comment === -1) return line;
	if (comment > 0 && line[comment - 1] === "-") return line;
	return line.slice(0, comment);
};

const applyReplacements = (line: string, replacements: Array<[RegExp, string]>): string => {
	let next = line;
	for (const [pattern, replacement] of replacements) {
		pattern.lastIndex = 0;
		next = next.replace(pattern, replacement);
	}
	return next;
};

const fixUnaryCall = (
	line: string,
	callee: string,
	replacement: (arg: string) => string,
): string | null => {
	const escaped = callee.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const pattern = new RegExp(`\\b${escaped}\\s*\\(\\s*([^)]+)\\s*\\)`);
	if (!pattern.test(line)) return null;
	return line.replace(pattern, (_, arg: string) => replacement(arg.trim()));
};

const fixBinaryCall = (
	line: string,
	callee: string,
	replacement: (a: string, b: string) => string,
): string | null => {
	const escaped = callee.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const pattern = new RegExp(`\\b${escaped}\\s*\\(\\s*([^,]+)\\s*,\\s*([^)]+)\\s*\\)`);
	const match = line.match(pattern);
	if (!match) return null;
	return line.replace(pattern, replacement(match[1].trim(), match[2].trim()));
};

export const removeStandaloneCall = (line: string, callee: string): string | null => {
	const code = stripLineComment(line).trim();
	const escaped = callee.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	if (!new RegExp(`^${escaped}\\s*\\(`).test(code)) return null;
	return "";
};

export const fixFloorDivision = (line: string): string | null => {
	const code = stripLineComment(line);
	if (!code.includes("//")) return null;
	const fixed = applyReplacements(code, [
		[/(\b[\w.]+|\))\s*\/\/\s*(\b[\w.]+|\()/g, "math.floor($1 / $2)"],
	]);
	return fixed !== code ? fixed + line.slice(code.length) : null;
};

export const fixBitwiseToBit32 = (line: string): string | null => {
	const code = stripLineComment(line);
	const fixed = applyReplacements(code, [
		[/(\b[\w.]+|\))\s*<<\s*(\b[\w.]+|\()/g, "bit32.lshift($1, $2)"],
		[/(\b[\w.]+|\))\s*>>\s*(\b[\w.]+|\()/g, "bit32.rshift($1, $2)"],
		[/(\b[\w.]+|\))\s*&\s*(\b[\w.]+|\()/g, "bit32.band($1, $2)"],
		[/(\b[\w.]+|\))\s*\|\s*(\b[\w.]+|\()/g, "bit32.bor($1, $2)"],
		[/(\b[\w.]+|\))\s*~\s*(\b[\w.]+|\()/g, "bit32.bxor($1, $2)"],
		[/~\s*(\b[\w.]+|\()/g, "bit32.bnot($1)"],
	]);
	return fixed !== code ? fixed + line.slice(code.length) : null;
};

export const fixBit32ToOperators = (line: string): string | null => {
	const code = stripLineComment(line);
	const fixed = applyReplacements(code, [
		[/bit32\.lshift\(([^,]+),\s*([^)]+)\)/g, "($1 << $2)"],
		[/bit32\.rshift\(([^,]+),\s*([^)]+)\)/g, "($1 >> $2)"],
		[/bit32\.band\(([^,]+),\s*([^)]+)\)/g, "($1 & $2)"],
		[/bit32\.bor\(([^,]+),\s*([^)]+)\)/g, "($1 | $2)"],
		[/bit32\.bxor\(([^,]+),\s*([^)]+)\)/g, "($1 ~ $2)"],
		[/bit32\.bnot\(([^)]+)\)/g, "(~$1)"],
	]);
	return fixed !== code ? fixed + line.slice(code.length) : null;
};

export const unaryDeprecatedRule = (
	rule: string,
	version: LuaVersion,
	pattern: RegExp,
	message: string,
	help: string,
	callee: string,
	replacement: (arg: string) => string,
): LuaVersionMismatchRule => ({
	rule,
	kind: "deprecated",
	version,
	pattern,
	message,
	help,
	fixable: true,
	shouldFlag: (target) => luaVersionAtLeast(target, version),
	fixLine: (line) => fixUnaryCall(line, callee, replacement),
});

export const binaryDeprecatedRule = (
	rule: string,
	version: LuaVersion,
	pattern: RegExp,
	message: string,
	help: string,
	callee: string,
	replacement: (a: string, b: string) => string,
): LuaVersionMismatchRule => ({
	rule,
	kind: "deprecated",
	version,
	pattern,
	message,
	help,
	fixable: true,
	shouldFlag: (target) => luaVersionAtLeast(target, version),
	fixLine: (line) => fixBinaryCall(line, callee, replacement),
});

export const envAccessorRule = (
	rule: string,
	fnName: string,
	message: string,
	help: string,
): LuaVersionMismatchRule => ({
	rule,
	kind: "deprecated",
	version: "5.2",
	pattern: new RegExp(`\\b${fnName}\\s*\\(`),
	message,
	help,
	fixable: false,
	shouldFlag: (target) => luaVersionAtLeast(target, "5.2"),
});
