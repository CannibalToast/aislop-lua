import { luaVersionAtLeast } from "../../lua/versions.js";
import {
	fixBitwiseToBit32,
	fixFloorDivision,
} from "./lua-version-rule-fixes.js";
import type { LuaVersionMismatchRule } from "./lua-version-rule-types.js";

export const LUA_VERSION_REQUIRES_RULES: readonly LuaVersionMismatchRule[] = [
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
		rule: "ai-slop/lua-version-package-searchers",
		kind: "requires",
		version: "5.2",
		pattern: /\bpackage\.searchers\b/,
		message: "`package.searchers` requires Lua 5.2 or newer",
		help: "Use `package.loaders` on Lua 5.1, or raise the project's Lua target.",
		fixable: true,
		shouldFlag: (target) => !luaVersionAtLeast(target, "5.2"),
		fixLine: (line) => {
			const next = line.replace(/\bpackage\.searchers\b/g, "package.loaders");
			return next !== line ? next : null;
		},
	},
	{
		rule: "ai-slop/lua-version-table-pack",
		kind: "requires",
		version: "5.2",
		pattern: /\btable\.pack\s*\(/,
		message: "`table.pack` requires Lua 5.2 or newer",
		help: "Use `{ n = select('#', ...), ... }` on older Lua targets, or upgrade.",
		fixable: false,
	},
];
