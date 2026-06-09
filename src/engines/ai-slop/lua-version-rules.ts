import { luaVersionAtLeast, type LuaVersion } from "../../lua/versions.js";
import { LUA_VERSION_DEPRECATED_RULES } from "./lua-version-rules-deprecated.js";
import { LUA_VERSION_REQUIRES_RULES } from "./lua-version-rules-requires.js";

export type { LuaVersionMismatchRule, VersionRuleKind } from "./lua-version-rule-types.js";

export const LUA_VERSION_MISMATCH_RULES = [
	...LUA_VERSION_REQUIRES_RULES,
	...LUA_VERSION_DEPRECATED_RULES,
] as const;

export const shouldFlagVersionRule = (
	rule: (typeof LUA_VERSION_MISMATCH_RULES)[number],
	target: LuaVersion,
): boolean => {
	if (rule.shouldFlag) return rule.shouldFlag(target);
	if (rule.kind === "requires") return !luaVersionAtLeast(target, rule.version);
	return luaVersionAtLeast(target, rule.version);
};
