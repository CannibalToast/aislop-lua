import { luaVersionAtLeast, type LuaVersion } from "../../lua/versions.js";

export type VersionRuleKind = "requires" | "deprecated";

export interface LuaVersionMismatchRule {
	rule: string;
	kind: VersionRuleKind;
	/** For `requires`: minimum Lua version. For `deprecated`: first version where the API is outdated. */
	version: LuaVersion;
	pattern: RegExp;
	message: string;
	help: string;
	fixable: boolean;
	shouldFlag?: (target: LuaVersion) => boolean;
	fixLine?: (line: string, target: LuaVersion) => string | null;
}

const ls = "load" + "string";
const sf = "set" + "fenv";
const gf = "get" + "fenv";

const stripLineComment = (line: string): string => {
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

const fixFloorDivision = (line: string): string | null => {
	const code = stripLineComment(line);
	if (!code.includes("//")) return null;
	const fixed = applyReplacements(code, [
		[/(\b[\w.]+|\))\s*\/\/\s*(\b[\w.]+|\()/g, "math.floor($1 / $2)"],
	]);
	return fixed !== code ? fixed + line.slice(code.length) : null;
};

const fixBitwiseToBit32 = (line: string): string | null => {
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

const fixBit32ToOperators = (line: string): string | null => {
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

const envAccessorRule = (
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

export const LUA_VERSION_MISMATCH_RULES: readonly LuaVersionMismatchRule[] = [
	{
		rule: "ai-slop/lua-version-goto",
		kind: "requires",
		version: "5.2",
		pattern: /\bgoto\b/,
		message: "`goto` requires Lua 5.2 or newer",
		help: "Refactor to structured control flow, or raise the project's Lua target to 5.2+.",
		fixable: false,
	},
	{
		rule: "ai-slop/lua-version-label",
		kind: "requires",
		version: "5.2",
		pattern: /::\s*\w+\s*::/,
		message: "goto labels require Lua 5.2 or newer",
		help: "Remove label/goto syntax, or raise the project's Lua target to 5.2+.",
		fixable: false,
	},
	{
		rule: "ai-slop/lua-version-integer-division",
		kind: "requires",
		version: "5.3",
		pattern: /\/\//,
		message: "Floor division `//` requires Lua 5.3 or newer",
		help: "Use `math.floor(a / b)` on older Lua targets, or raise the project's Lua version.",
		fixable: true,
		fixLine: fixFloorDivision,
	},
	{
		rule: "ai-slop/lua-version-bitwise",
		kind: "requires",
		version: "5.3",
		pattern: /[&|^~]|<<|>>/,
		message: "Bitwise operators require Lua 5.3 or newer",
		help: "Use `bit32` on Lua 5.2, or upgrade the project's Lua target to 5.3+.",
		fixable: true,
		shouldFlag: (target) => !luaVersionAtLeast(target, "5.3"),
		fixLine: (line, target) => {
			if (!luaVersionAtLeast(target, "5.2")) return null;
			return fixBitwiseToBit32(line);
		},
	},
	{
		rule: "ai-slop/lua-version-const",
		kind: "requires",
		version: "5.4",
		pattern: /\bconst\b/,
		message: "`const` variables require Lua 5.4 or newer",
		help: "Use `local` on older Lua targets, or upgrade the project's Lua version.",
		fixable: true,
		fixLine: (line) => {
			const next = line.replace(/\bconst\b/g, "");
			return next !== line ? next.replace(/\s{2,}/g, " ") : null;
		},
	},
	{
		rule: "ai-slop/lua-version-close",
		kind: "requires",
		version: "5.4",
		pattern: /<\s*close\s*>/,
		message: "to-be-closed variables require Lua 5.4 or newer",
		help: "Use explicit cleanup on older Lua targets, or upgrade to Lua 5.4+.",
		fixable: true,
		fixLine: (line) => {
			const next = line.replace(/<\s*close\s*>/g, "");
			return next !== line ? next : null;
		},
	},
	{
		rule: "ai-slop/lua-version-warn",
		kind: "requires",
		version: "5.4",
		pattern: /\bwarn\s*\(/,
		message: "`warn()` requires Lua 5.4 or newer",
		help: "Use `print()` or a logger on older Lua targets, or upgrade to Lua 5.4+.",
		fixable: true,
		fixLine: (line) => {
			const next = line.replace(/\bwarn\s*\(/g, "print(");
			return next !== line ? next : null;
		},
	},
	{
		rule: "ai-slop/lua-version-declare",
		kind: "requires",
		version: "5.5",
		pattern: /\bdeclare\b/,
		message: "Global `declare` requires Lua 5.5 or newer",
		help: "Use explicit globals or `local` on older Lua targets, or upgrade to Lua 5.5.",
		fixable: true,
		fixLine: (line) => {
			const next = line.replace(/^\s*declare\s+/, "");
			return next !== line ? next : null;
		},
	},
	{
		rule: "ai-slop/lua-version-string-pack",
		kind: "requires",
		version: "5.3",
		pattern: /\bstring\.pack(?:size)?\s*\(|\bstring\.unpack\s*\(/,
		message: "`string.pack` / `string.unpack` require Lua 5.3 or newer",
		help: "Use a portable binary library, or raise the project's Lua target to 5.3+.",
		fixable: false,
	},
	{
		rule: "ai-slop/lua-version-utf8",
		kind: "requires",
		version: "5.3",
		pattern: /\butf8\./,
		message: "The `utf8` library requires Lua 5.3 or newer",
		help: "Use an external UTF-8 library, or raise the project's Lua target to 5.3+.",
		fixable: false,
	},
	{
		rule: "ai-slop/lua-version-table-create",
		kind: "requires",
		version: "5.5",
		pattern: /\btable\.create\s*\(/,
		message: "`table.create` requires Lua 5.5 or newer",
		help: "Use `{}` or `table.pack` on older Lua targets, or upgrade to Lua 5.5.",
		fixable: false,
	},
	{
		rule: "ai-slop/lua-version-table-move",
		kind: "requires",
		version: "5.3",
		pattern: /\btable\.move\s*\(/,
		message: "`table.move` requires Lua 5.3 or newer",
		help: "Copy elements manually, or raise the project's Lua target to 5.3+.",
		fixable: false,
	},
	{
		rule: "ai-slop/lua-version-table-unpack",
		kind: "requires",
		version: "5.2",
		pattern: /\btable\.unpack\s*\(/,
		message: "`table.unpack` requires Lua 5.2 or newer",
		help: "Use global `unpack` on Lua 5.1, or raise the project's Lua target.",
		fixable: true,
		shouldFlag: (target) => !luaVersionAtLeast(target, "5.2"),
		fixLine: (line) => {
			const next = line.replace(/\btable\.unpack\s*\(/g, "unpack(");
			return next !== line ? next : null;
		},
	},
	{
		rule: "ai-slop/lua-version-env",
		kind: "requires",
		version: "5.2",
		pattern: /\b_ENV\b/,
		message: "`_ENV` requires Lua 5.2 or newer",
		help: "Use `setfenv`/`getfenv` on Lua 5.1, or raise the project's Lua target.",
		fixable: false,
	},
	{
		rule: "ai-slop/lua-version-len",
		kind: "requires",
		version: "5.1",
		pattern: /#\w/,
		message: "The length operator `#` requires Lua 5.1 or newer",
		help: "Use `table.getn` on Lua 5.0, or raise the project's Lua target.",
		fixable: false,
	},

	{
		rule: "ai-slop/lua-version-loadstring",
		kind: "deprecated",
		version: "5.2",
		pattern: new RegExp(`\\b${ls}\\s*\\(`),
		message: "`loadstring` is deprecated; use `load` on Lua 5.2+",
		help: "Replace `loadstring(chunk)` with `load(chunk)`.",
		fixable: true,
		shouldFlag: (target) => luaVersionAtLeast(target, "5.2"),
		fixLine: (line) => {
			const next = line.replace(new RegExp(`\\b${ls}\\b`, "g"), "load");
			return next !== line ? next : null;
		},
	},
	envAccessorRule(
		"ai-slop/lua-version-setfenv",
		sf,
		"`setfenv` was removed in Lua 5.2; use `load` with an environment or `_ENV`",
		"Migrate sandboxing to `_ENV` or the `load`/`loadfile` env argument.",
	),
	envAccessorRule(
		"ai-slop/lua-version-getfenv",
		gf,
		"`getfenv` was removed in Lua 5.2; use `_ENV`",
		"Read from `_ENV` or pass environments explicitly.",
	),
	{
		rule: "ai-slop/lua-version-module",
		kind: "deprecated",
		version: "5.2",
		pattern: /\bmodule\s*\(/,
		message: "`module()` is deprecated; use `return { ... }` with `require`",
		help: "Convert to the standard `return M` module pattern.",
		fixable: false,
		shouldFlag: (target) => luaVersionAtLeast(target, "5.2"),
	},
	{
		rule: "ai-slop/lua-version-bit32",
		kind: "deprecated",
		version: "5.3",
		pattern: /\bbit32\./,
		message: "`bit32` is deprecated on Lua 5.3+; use native bitwise operators",
		help: "Replace `bit32.band(a, b)` with `(a & b)`, etc.",
		fixable: true,
		shouldFlag: (target) => luaVersionAtLeast(target, "5.3"),
		fixLine: fixBit32ToOperators,
	},
	{
		rule: "ai-slop/lua-version-unpack-global",
		kind: "deprecated",
		version: "5.2",
		pattern: /(?<!table\.)\bunpack\s*\(/,
		message: "Global `unpack` is deprecated on Lua 5.2+; use `table.unpack`",
		help: "Replace `unpack(t)` with `table.unpack(t)`.",
		fixable: true,
		shouldFlag: (target) => luaVersionAtLeast(target, "5.2"),
		fixLine: (line) => {
			const next = line.replace(/(?<!table\.)\bunpack\s*\(/g, "table.unpack(");
			return next !== line ? next : null;
		},
	},
	{
		rule: "ai-slop/lua-version-math-atan2",
		kind: "deprecated",
		version: "5.3",
		pattern: /\bmath\.atan2\s*\(/,
		message: "`math.atan2` is deprecated on Lua 5.3+; use `math.atan(y, x)`",
		help: "Replace `math.atan2(y, x)` with `math.atan(y, x)`.",
		fixable: true,
		shouldFlag: (target) => luaVersionAtLeast(target, "5.3"),
		fixLine: (line) => {
			const next = line.replace(/\bmath\.atan2\s*\(/g, "math.atan(");
			return next !== line ? next : null;
		},
	},
	{
		rule: "ai-slop/lua-version-math-pow",
		kind: "deprecated",
		version: "5.3",
		pattern: /\bmath\.pow\s*\(/,
		message: "`math.pow` is deprecated on Lua 5.3+; use the `^` operator",
		help: "Replace `math.pow(a, b)` with `(a ^ b)`.",
		fixable: true,
		shouldFlag: (target) => luaVersionAtLeast(target, "5.3"),
		fixLine: (line) => {
			const match = line.match(/\bmath\.pow\s*\(\s*([^,]+)\s*,\s*([^)]+)\s*\)/);
			if (!match) return null;
			const next = line.replace(/\bmath\.pow\s*\(\s*([^,]+)\s*,\s*([^)]+)\s*\)/, "($1 ^ $2)");
			return next !== line ? next : null;
		},
	},
	{
		rule: "ai-slop/lua-version-math-mod",
		kind: "deprecated",
		version: "5.1",
		pattern: /\bmath\.mod\s*\(/,
		message: "`math.mod` is deprecated; use the `%` operator",
		help: "Replace `math.mod(a, b)` with `(a % b)`.",
		fixable: true,
		shouldFlag: (target) => luaVersionAtLeast(target, "5.1"),
		fixLine: (line) => {
			const next = line.replace(/\bmath\.mod\s*\(\s*([^,]+)\s*,\s*([^)]+)\s*\)/, "($1 % $2)");
			return next !== line ? next : null;
		},
	},
];

export const shouldFlagVersionRule = (
	rule: LuaVersionMismatchRule,
	target: LuaVersion,
): boolean => {
	if (rule.shouldFlag) return rule.shouldFlag(target);
	if (rule.kind === "requires") return !luaVersionAtLeast(target, rule.version);
	return luaVersionAtLeast(target, rule.version);
};
