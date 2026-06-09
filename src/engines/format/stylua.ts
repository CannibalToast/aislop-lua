import path from "node:path";
import { styluaSyntaxFor } from "../../lua/versions.js";
import { resolveLuaVersion } from "../../utils/lua-version.js";
import { runSubprocess } from "../../utils/subprocess.js";
import type { Diagnostic, EngineContext } from "../types.js";

export const runStylua = async (context: EngineContext): Promise<Diagnostic[]> => {
	try {
		const luaVersion = resolveLuaVersion(context.rootDirectory);
		const syntax = styluaSyntaxFor(luaVersion);
		const result = await runSubprocess(
			"stylua",
			["--check", "--syntax", syntax, context.rootDirectory],
			{
				cwd: context.rootDirectory,
				timeout: 60000,
			},
		);

		const output = result.stdout || result.stderr;
		if (!output) return [];

		const diagnostics: Diagnostic[] = [];
		for (const line of output.split("\n")) {
			const match = line.match(/Diff in (.+) at line (\d+)/);
			if (!match) continue;
			diagnostics.push({
				filePath: path.relative(context.rootDirectory, match[1]),
				engine: "format",
				rule: "lua-formatting",
				severity: "warning",
				message: "Lua file is not formatted correctly",
				help: "Run `aislop fix` to auto-format with StyLua",
				line: parseInt(match[2], 10),
				column: 0,
				category: "Format",
				fixable: true,
			});
		}
		return diagnostics;
	} catch {
		return [];
	}
};

export const fixStylua = async (rootDirectory: string): Promise<void> => {
	const luaVersion = resolveLuaVersion(rootDirectory);
	const syntax = styluaSyntaxFor(luaVersion);
	const result = await runSubprocess("stylua", ["--syntax", syntax, rootDirectory], {
		cwd: rootDirectory,
		timeout: 60000,
	});
	if (result.exitCode !== 0) {
		throw new Error(result.stderr || result.stdout || `stylua exited with code ${result.exitCode}`);
	}
};
