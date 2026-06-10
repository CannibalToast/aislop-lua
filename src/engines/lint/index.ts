import type { Diagnostic, Engine, EngineContext, EngineResult } from "../types.js";
import { runGenericLinter } from "./generic.js";
import { runGolangciLint } from "./golangci.js";
import { runOxlint } from "./oxlint.js";
import { runLuacheck } from "./luacheck.js";
import { runRuffLint } from "./ruff.js";
import { appendAll } from "../../utils/append.js";

export const lintEngine: Engine = {
	name: "lint",

	async run(context: EngineContext): Promise<EngineResult> {
		const diagnostics: Diagnostic[] = [];
		const { languages, installedTools } = context;

		const promises: Promise<Diagnostic[]>[] = [];

		if (languages.includes("typescript") || languages.includes("javascript")) {
			promises.push(runOxlint(context));
			if (context.config.lint.typecheck) {
				promises.push(import("./typecheck.js").then((mod) => mod.runTypecheck(context)));
			}
		}

		if (context.frameworks.includes("expo")) {
			// Lazy-load expo-doctor only when Expo is detected
			promises.push(import("./expo-doctor.js").then((mod) => mod.runExpoDoctor(context)));
		}

		if (languages.includes("python") && installedTools.ruff) {
			promises.push(runRuffLint(context));
		}

		if (languages.includes("go") && installedTools["golangci-lint"]) {
			promises.push(runGolangciLint(context));
		}

		if (languages.includes("rust") && installedTools.cargo) {
			promises.push(runGenericLinter(context, "rust"));
		}

		if (languages.includes("ruby") && installedTools.rubocop) {
			promises.push(runGenericLinter(context, "ruby"));
		}

		if (languages.includes("lua") && installedTools.luacheck) {
			promises.push(runLuacheck(context));
		}

		const results = await Promise.allSettled(promises);
		for (const result of results) {
			if (result.status === "fulfilled") {
				appendAll(diagnostics, result.value);
			}
		}

		return {
			engine: "lint",
			diagnostics,
			elapsed: 0,
			skipped: false,
		};
	},
};
