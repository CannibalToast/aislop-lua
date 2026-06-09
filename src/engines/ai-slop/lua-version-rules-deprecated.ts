import { luaVersionAtLeast } from "../../lua/versions.js";
import {
	envAccessorRule,
	fixBinaryCall,
	fixBit32ToOperators,
	fixUnaryCall,
	gf,
	ls,
	removeStandaloneCall,
	sf,
} from "./lua-version-rule-fixes.js";
import type { LuaVersionMismatchRule } from "./lua-version-rule-types.js";

export const LUA_VERSION_DEPRECATED_RULES: readonly LuaVersionMismatchRule[] = [
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
	{
		rule: "ai-slop/lua-version-gfind",
		kind: "deprecated",
		version: "5.1",
		pattern: /\bstring\.gfind\s*\(/,
		message: "`string.gfind` was renamed; use `string.gmatch`",
		help: "Replace `string.gfind` with `string.gmatch`.",
		fixable: true,
		shouldFlag: (target) => luaVersionAtLeast(target, "5.1"),
		fixLine: (line) => {
			const next = line.replace(/\bstring\.gfind\b/g, "string.gmatch");
			return next !== line ? next : null;
		},
	},
	{
		rule: "ai-slop/lua-version-table-getn",
		kind: "deprecated",
		version: "5.2",
		pattern: /\btable\.getn\s*\(/,
		message: "`table.getn` was removed in Lua 5.2; use the `#` operator",
		help: "Replace `table.getn(t)` with `#t`.",
		fixable: true,
		shouldFlag: (target) => luaVersionAtLeast(target, "5.2"),
		fixLine: (line) => fixUnaryCall(line, "table.getn", (arg) => `#(${arg})`),
	},
	{
		rule: "ai-slop/lua-version-table-setn",
		kind: "deprecated",
		version: "5.2",
		pattern: /\btable\.setn\s*\(/,
		message: "`table.setn` was removed in Lua 5.2; array length is automatic",
		help: "Remove `table.setn` calls; Lua manages sequence length via `#`.",
		fixable: true,
		shouldFlag: (target) => luaVersionAtLeast(target, "5.2"),
		fixLine: (line) => removeStandaloneCall(line, "table.setn"),
	},
	{
		rule: "ai-slop/lua-version-table-maxn",
		kind: "deprecated",
		version: "5.2",
		pattern: /\btable\.maxn\s*\(/,
		message: "`table.maxn` was removed in Lua 5.2",
		help: "Use `#t` for sequences, or scan with `pairs` if embedded nils matter.",
		fixable: false,
		shouldFlag: (target) => luaVersionAtLeast(target, "5.2"),
	},
	{
		rule: "ai-slop/lua-version-table-foreach",
		kind: "deprecated",
		version: "5.2",
		pattern: /\btable\.foreachi?\s*\(/,
		message: "`table.foreach` was removed in Lua 5.2; use `pairs` or `ipairs`",
		help: "Rewrite with `for k, v in pairs(t) do ... end`.",
		fixable: false,
		shouldFlag: (target) => luaVersionAtLeast(target, "5.2"),
	},
	{
		rule: "ai-slop/lua-version-package-loaders",
		kind: "deprecated",
		version: "5.2",
		pattern: /\bpackage\.loaders\b/,
		message: "`package.loaders` was renamed to `package.searchers` in Lua 5.2",
		help: "Replace `package.loaders` with `package.searchers`.",
		fixable: true,
		shouldFlag: (target) => luaVersionAtLeast(target, "5.2"),
		fixLine: (line) => {
			const next = line.replace(/\bpackage\.loaders\b/g, "package.searchers");
			return next !== line ? next : null;
		},
	},
	{
		rule: "ai-slop/lua-version-loadlib",
		kind: "deprecated",
		version: "5.1",
		pattern: /\bloadlib\s*\(/,
		message: "`loadlib` was moved to `package.loadlib` in Lua 5.1",
		help: "Replace `loadlib(...)` with `package.loadlib(...)`.",
		fixable: true,
		shouldFlag: (target) => luaVersionAtLeast(target, "5.1"),
		fixLine: (line) => {
			const next = line.replace(/\bloadlib\s*\(/g, "package.loadlib(");
			return next !== line ? next : null;
		},
	},
	{
		rule: "ai-slop/lua-version-math-log10",
		kind: "deprecated",
		version: "5.3",
		pattern: /\bmath\.log10\s*\(/,
		message: "`math.log10` is deprecated on Lua 5.3+; use `math.log(x, 10)`",
		help: "Replace `math.log10(x)` with `math.log(x, 10)`.",
		fixable: true,
		shouldFlag: (target) => luaVersionAtLeast(target, "5.3"),
		fixLine: (line) => fixUnaryCall(line, "math.log10", (arg) => `math.log(${arg}, 10)`),
	},
	{
		rule: "ai-slop/lua-version-math-ldexp",
		kind: "deprecated",
		version: "5.3",
		pattern: /\bmath\.ldexp\s*\(/,
		message: "`math.ldexp` is deprecated on Lua 5.3+; use `x * 2.0^exp`",
		help: "Replace `math.ldexp(x, exp)` with `(x * 2.0 ^ exp)`.",
		fixable: true,
		shouldFlag: (target) => luaVersionAtLeast(target, "5.3"),
		fixLine: (line) => fixBinaryCall(line, "math.ldexp", (x, exp) => `(${x} * 2.0 ^ ${exp})`),
	},
	{
		rule: "ai-slop/lua-version-math-frexp",
		kind: "deprecated",
		version: "5.3",
		pattern: /\bmath\.frexp\s*\(/,
		message: "`math.frexp` was removed from the standard library on Lua 5.4+",
		help: "Provide a custom implementation or depend on a math compatibility layer.",
		fixable: false,
		shouldFlag: (target) => luaVersionAtLeast(target, "5.3"),
	},
	{
		rule: "ai-slop/lua-version-math-hyperbolic",
		kind: "deprecated",
		version: "5.3",
		pattern: /\bmath\.(?:cosh|sinh|tanh)\s*\(/,
		message: "Hyperbolic math functions were removed from the standard library on Lua 5.4+",
		help: "Use an external math library or inline the formulas with `math.exp`.",
		fixable: false,
		shouldFlag: (target) => luaVersionAtLeast(target, "5.3"),
	},
	{
		rule: "ai-slop/lua-version-debug-fenv",
		kind: "deprecated",
		version: "5.2",
		pattern: /\bdebug\.(?:get|set)fenv\s*\(/,
		message: "`debug.getfenv` / `debug.setfenv` were removed in Lua 5.2",
		help: "Use `_ENV` or the `load` environment argument instead of debug environment APIs.",
		fixable: false,
		shouldFlag: (target) => luaVersionAtLeast(target, "5.2"),
	},
];
