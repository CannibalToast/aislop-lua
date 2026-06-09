import { describe, expect, it, vi } from "vitest";

vi.mock("../src/utils/subprocess.js", () => ({
	runSubprocess: vi.fn(),
}));

vi.mock("../src/utils/lua-version.js", () => ({
	resolveLuaVersion: () => "5.4",
}));

import { runSubprocess } from "../src/utils/subprocess.js";
import { runLuacheck } from "../src/engines/lint/luacheck.js";
import type { EngineContext } from "../src/engines/types.js";

const context: EngineContext = {
	rootDirectory: "/proj",
	languages: ["lua"],
	frameworks: ["none"],
	installedTools: { luacheck: true },
	config: {
		quality: { maxFunctionLoc: 80, maxFileLoc: 400, maxNesting: 4, maxParams: 6 },
		security: { audit: false, auditTimeout: 60 },
		lint: { typecheck: false },
	},
};

describe("runLuacheck output parsing", () => {
	it("parses --codes format with warning prefix", async () => {
		vi.mocked(runSubprocess).mockResolvedValue({
			exitCode: 1,
			stdout: "    messy.lua:2:1: (W521) unused label 'dead_label'\n",
			stderr: "",
		});

		const diagnostics = await runLuacheck(context);
		expect(diagnostics).toHaveLength(1);
		expect(diagnostics[0].rule).toBe("luacheck/521");
		expect(diagnostics[0].message).toBe("unused label 'dead_label'");
		expect(diagnostics[0].fixable).toBe(true);
	});
});
