import fs from "node:fs";
import path from "node:path";
import { type LuaVersion, parseLuaVersion, SUPPORTED_LUA_VERSIONS } from "../lua/versions.js";

export interface LuaProjectInfo {
	version: LuaVersion | null;
	source: string | null;
}

const readText = (filePath: string): string | null => {
	try {
		return fs.readFileSync(filePath, "utf-8");
	} catch {
		return null;
	}
};

const parseJsonc = (content: string): unknown => {
	const stripped = content.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
	return JSON.parse(stripped);
};

const versionFromLuarc = (rootDirectory: string): LuaVersion | null => {
	for (const name of [".luarc.json", ".luarc.jsonc"]) {
		const content = readText(path.join(rootDirectory, name));
		if (!content) continue;
		try {
			const config = (name.endsWith(".jsonc") ? parseJsonc(content) : JSON.parse(content)) as {
				runtime?: { version?: string };
			};
			const parsed = config.runtime?.version ? parseLuaVersion(config.runtime.version) : null;
			if (parsed) return parsed;
		} catch {
			// ignore malformed config
		}
	}
	return null;
};

const versionFromStylua = (rootDirectory: string): LuaVersion | null => {
	for (const name of ["stylua.toml", ".stylua.toml"]) {
		const content = readText(path.join(rootDirectory, name));
		if (!content) continue;
		const match = content.match(/^\s*syntax\s*=\s*["']?([^"'\n#]+)["']?\s*$/im);
		if (!match) continue;
		const syntax = match[1].trim().toLowerCase();
		if (syntax === "all" || syntax === "luajit" || syntax === "luau" || syntax === "cfxlua") {
			continue;
		}
		const parsed = parseLuaVersion(syntax);
		if (parsed) return parsed;
	}
	return null;
};

const versionFromSelene = (rootDirectory: string): LuaVersion | null => {
	const content = readText(path.join(rootDirectory, "selene.toml"));
	if (!content) return null;
	const match = content.match(/^\s*std\s*=\s*["']([^"']+)["']\s*$/im);
	if (!match) return null;
	const std = match[1].trim().toLowerCase();
	if (std === "lua51" || std === "lua52" || std === "lua53" || std === "lua54") {
		return parseLuaVersion(std.replace(/^lua/, ""));
	}
	return parseLuaVersion(std);
};

const versionFromLuacheck = (rootDirectory: string): LuaVersion | null => {
	for (const name of [".luacheckrc", ".luacheckrc.lua"]) {
		const content = readText(path.join(rootDirectory, name));
		if (!content) continue;
		const match = content.match(/std\s*=\s*["']([^"']+)["']/i);
		if (!match) continue;
		const parsed = parseLuaVersion(match[1].replace(/^lua/i, ""));
		if (parsed) return parsed;
	}
	return null;
};

const versionFromRockspec = (rootDirectory: string): LuaVersion | null => {
	let entries: fs.Dirent[];
	try {
		entries = fs.readdirSync(rootDirectory, { withFileTypes: true });
	} catch {
		return null;
	}

	for (const entry of entries) {
		if (!entry.isFile() || !entry.name.endsWith(".rockspec")) continue;
		const content = readText(path.join(rootDirectory, entry.name));
		if (!content) continue;
		const match = content.match(/lua\s*>=\s*["']?(5\.[0-5])/i);
		if (match) {
			const parsed = parseLuaVersion(match[1]);
			if (parsed) return parsed;
		}
	}
	return null;
};

const versionFromRockManifest = (rootDirectory: string): LuaVersion | null => {
	const content = readText(path.join(rootDirectory, "rock_manifest"));
	if (!content) return null;
	const match = content.match(/lua\s*>=\s*["']?(5\.[0-5])/i);
	return match ? parseLuaVersion(match[1]) : null;
};

const DETECTORS: Array<{ source: string; detect: (root: string) => LuaVersion | null }> = [
	{ source: ".luarc.json", detect: versionFromLuarc },
	{ source: "stylua.toml", detect: versionFromStylua },
	{ source: "selene.toml", detect: versionFromSelene },
	{ source: ".luacheckrc", detect: versionFromLuacheck },
	{ source: ".rockspec", detect: versionFromRockspec },
	{ source: "rock_manifest", detect: versionFromRockManifest },
];

export const detectLuaVersion = (rootDirectory: string): LuaProjectInfo => {
	for (const detector of DETECTORS) {
		const version = detector.detect(rootDirectory);
		if (version) {
			return { version, source: detector.source };
		}
	}
	return { version: null, source: null };
};

export const defaultLuaVersion = (): LuaVersion => "5.4";

export const resolveLuaVersion = (rootDirectory: string): LuaVersion =>
	detectLuaVersion(rootDirectory).version ?? defaultLuaVersion();

export const isSupportedLuaVersion = (version: string): version is LuaVersion =>
	SUPPORTED_LUA_VERSIONS.includes(version as LuaVersion);
