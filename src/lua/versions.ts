/**
 * Lua version metadata sourced from https://www.lua.org/versions.html and
 * https://www.lua.org/ftp/ (release dates, last releases, feature summaries).
 *
 * Numbering: x.y.z — x is series, x.y is the version, z is the release.
 * Same-version releases are ABI-compatible; different versions are not.
 */

export type LuaVersion = "5.0" | "5.1" | "5.2" | "5.3" | "5.4" | "5.5";

export interface LuaReleaseInfo {
	version: LuaVersion;
	initialRelease: string;
	lastRelease: string | null;
	lastReleaseDate: string | null;
	frozen: boolean;
	features: string[];
}

export const LUA_VERSIONS: readonly LuaReleaseInfo[] = [
	{
		version: "5.0",
		initialRelease: "2003-04-11",
		lastRelease: "5.0.3",
		lastReleaseDate: "2006-06-26",
		frozen: true,
		features: [
			"Collaborative multithreading via coroutines",
			"Full lexical scoping (replacing upvalues)",
			"Metatables instead of tags and tag methods",
			"Booleans, proper tail calls, and weak tables",
		],
	},
	{
		version: "5.1",
		initialRelease: "2006-02-21",
		lastRelease: "5.1.5",
		lastReleaseDate: "2012-02-17",
		frozen: true,
		features: [
			"New module system",
			"Incremental garbage collection",
			"New vararg mechanism and long-string/comment syntax",
			"Mod and length operators; metatables for all types",
		],
	},
	{
		version: "5.2",
		initialRelease: "2011-12-16",
		lastRelease: "5.2.4",
		lastReleaseDate: "2015-03-07",
		frozen: true,
		features: [
			"Yieldable pcall and metamethods",
			"New lexical scheme for globals (_ENV)",
			"Ephemeron tables, bit32 library, light C functions",
			"goto statement and table finalizers",
		],
	},
	{
		version: "5.3",
		initialRelease: "2015-01-12",
		lastRelease: "5.3.6",
		lastReleaseDate: "2020-09-25",
		frozen: true,
		features: [
			"Integers and bitwise operators",
			"Basic utf-8 library",
			"Support for both 64-bit and 32-bit platforms",
		],
	},
	{
		version: "5.4",
		initialRelease: "2020-06-29",
		lastRelease: "5.4.8",
		lastReleaseDate: "2025-06-04",
		frozen: false,
		features: ["Generational mode for garbage collection", "const and to-be-closed variables"],
	},
	{
		version: "5.5",
		initialRelease: "2025-12-22",
		lastRelease: "5.5.0",
		lastReleaseDate: "2025-12-22",
		frozen: false,
		features: [
			"Declarations for global variables",
			"Named vararg tables",
			"More compact arrays",
			"Major garbage collections done incrementally",
		],
	},
] as const;

export const SUPPORTED_LUA_VERSIONS: readonly LuaVersion[] = LUA_VERSIONS.map((v) => v.version);

const VERSION_ORDER: Record<LuaVersion, number> = {
	"5.0": 50,
	"5.1": 51,
	"5.2": 52,
	"5.3": 53,
	"5.4": 54,
	"5.5": 55,
};

export const compareLuaVersions = (a: LuaVersion, b: LuaVersion): number =>
	VERSION_ORDER[a] - VERSION_ORDER[b];

export const luaVersionAtLeast = (current: LuaVersion, minimum: LuaVersion): boolean =>
	compareLuaVersions(current, minimum) >= 0;

export const luaVersionInfo = (version: LuaVersion): LuaReleaseInfo | undefined =>
	LUA_VERSIONS.find((v) => v.version === version);

/** StyLua syntax names; 5.0 and 5.5 fall back to the nearest supported dialect. */
export const styluaSyntaxFor = (version: LuaVersion): string => {
	switch (version) {
		case "5.0":
			return "lua51";
		case "5.1":
			return "lua51";
		case "5.2":
			return "lua52";
		case "5.3":
			return "lua53";
		case "5.4":
		case "5.5":
			return "lua54";
	}
};

/** Luacheck --std values (5.0 uses the 5.1 stdlib as closest match). */
export const luacheckStdFor = (version: LuaVersion): string => {
	switch (version) {
		case "5.0":
		case "5.1":
			return "lua51";
		case "5.2":
			return "lua52";
		case "5.3":
			return "lua53";
		case "5.4":
		case "5.5":
			return "lua54";
	}
};

export const parseLuaVersion = (raw: string): LuaVersion | null => {
	const normalized = raw
		.trim()
		.toLowerCase()
		.replace(/^lua\s*/i, "");
	const dotted = normalized.match(/^(5\.[0-5])(?:\.\d+)?$/);
	if (dotted) {
		const version = dotted[1] as LuaVersion;
		return SUPPORTED_LUA_VERSIONS.includes(version) ? version : null;
	}
	const compact = normalized.match(/^5([0-5])$/);
	if (compact) {
		const version = `5.${compact[1]}` as LuaVersion;
		return SUPPORTED_LUA_VERSIONS.includes(version) ? version : null;
	}
	return null;
};
