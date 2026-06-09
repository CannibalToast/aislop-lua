import path from "node:path";
import { luacheckStdFor } from "../../lua/versions.js";
import { resolveLuaVersion } from "../../utils/lua-version.js";
import { runSubprocess } from "../../utils/subprocess.js";
import type { Diagnostic, EngineContext } from "../types.js";
import { isLuacheckFixable } from "./luacheck-fix.js";

const LUACHECK_LINE_RE = /^(.+?):(\d+):(\d+):\s*(.+?)(?:\s+\((?:W)?(\d+)\))?$/;

export const runLuacheck = async (context: EngineContext): Promise<Diagnostic[]> => {
	try {
		const luaVersion = resolveLuaVersion(context.rootDirectory);
		const std = luacheckStdFor(luaVersion);
		const result = await runSubprocess(
			"luacheck",
			["--no-color", "--codes", "--std", std, context.rootDirectory],
			{
				cwd: context.rootDirectory,
				timeout: 120000,
			},
		);

		const output = result.stdout || result.stderr;
		if (!output) return [];

		const diagnostics: Diagnostic[] = [];
		for (const line of output.split("\n")) {
			const match = LUACHECK_LINE_RE.exec(line.trim());
			if (!match) continue;
			const [, file, lineNo, col, message, code] = match;
			const relPath = path.isAbsolute(file) ? path.relative(context.rootDirectory, file) : file;
			diagnostics.push({
				filePath: relPath,
				engine: "lint",
				rule: code ? `luacheck/${code}` : "luacheck/unknown",
				severity: message.toLowerCase().includes("error") ? "error" : "warning",
				message,
				help: "",
				line: parseInt(lineNo, 10),
				column: parseInt(col, 10),
				category: "Lua Lint",
				fixable: isLuacheckFixable(code),
			});
		}
		return diagnostics;
	} catch {
		return [];
	}
};
