import type { LuaVersion } from "../../lua/versions.js";

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
