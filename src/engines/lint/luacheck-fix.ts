import fs from "node:fs";
import path from "node:path";
import type { Diagnostic, EngineContext } from "../types.js";
import { runLuacheck } from "./luacheck.js";

const LUACHECK_FIXABLE = new Set([
	"111",
	"131",
	"211",
	"212",
	"213",
	"231",
	"232",
	"233",
	"511",
	"521",
	"541",
	"542",
	"551",
	"581",
	"582",
	"611",
	"612",
	"614",
]);

export const isLuacheckFixable = (code: string | undefined): boolean =>
	code !== undefined && LUACHECK_FIXABLE.has(code.replace(/^W/i, ""));

const normalizeCode = (code: string): string => code.replace(/^W/i, "");

const extractQuotedName = (message: string): string | null => {
	const match = message.match(/'([^']+)'/);
	return match?.[1] ?? null;
};

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const prefixIdentifier = (line: string, name: string): string | null => {
	if (name.startsWith("_")) return null;
	const escaped = escapeRegExp(name);
	const patterns: Array<[RegExp, string]> = [
		[new RegExp(`(local\\s+)${escaped}\\b`), `$1_${name}`],
		[new RegExp(`(function\\s*\\([^)]*\\b)${escaped}\\b`), `$1_${name}`],
		[new RegExp(`(\\([^)]*\\b)${escaped}\\b`), `$1_${name}`],
		[new RegExp(`(\\bfor\\s+[\\w.,\\s]*\\b)${escaped}\\b`), `$1_${name}`],
		[new RegExp(`\\b${escaped}\\b`), `_${name}`],
	];
	for (const [pattern, replacement] of patterns) {
		if (!pattern.test(line)) continue;
		pattern.lastIndex = 0;
		const next = line.replace(pattern, replacement);
		if (next !== line) return next;
	}
	return null;
};

const fixUndefinedGlobal = (line: string, name: string): string | null => {
	if (/\blocal\b/.test(line)) return null;
	const escaped = escapeRegExp(name);
	const match = line.match(new RegExp(`^(\\s*)${escaped}\\s*=`));
	if (!match) return null;
	return line.replace(new RegExp(`^(\\s*)${escaped}\\s*=`), `$1local ${name} =`);
};

const isUnusedGlobalAssignment = (line: string, name: string): boolean =>
	new RegExp(`^\\s*${escapeRegExp(name)}\\s*=`).test(line);

const fixNegatedRelation = (line: string): string | null => {
	const patterns: Array<[RegExp, string]> = [
		[/\bnot\s+(\w+)\s*==\s*(\w+)\b/, "$1 ~= $2"],
		[/\bnot\s+(\w+)\s*~=\s*(\w+)\b/, "$1 == $2"],
		[/\bnot\s+(\w+)\s*>\s*(\w+)\b/, "$1 <= $2"],
		[/\bnot\s+(\w+)\s*>=\s*(\w+)\b/, "$1 < $2"],
		[/\bnot\s+(\w+)\s*<\s*(\w+)\b/, "$1 >= $2"],
		[/\bnot\s+(\w+)\s*<=\s*(\w+)\b/, "$1 > $2"],
	];
	for (const [pattern, replacement] of patterns) {
		if (!pattern.test(line)) continue;
		const next = line.replace(pattern, replacement);
		if (next !== line) return next;
	}
	return null;
};

const fixUnusedLabel = (line: string, name: string): string | null => {
	const escaped = escapeRegExp(name);
	const label = new RegExp(`::\\s*${escaped}\\s*::`);
	if (!label.test(line)) return null;
	const next = line.replace(label, "").trimEnd();
	return next === "" ? "" : next;
};

const fixEmptyBlockLine = (line: string): string | null => {
	const trimmed = line.trim();
	if (/^do\s+end$/.test(trimmed)) return "";
	if (/^if\b.+then\s+end$/.test(trimmed)) return "";
	if (/^elseif\b.+then\s+end$/.test(trimmed)) return "";
	if (/^else\s+end$/.test(trimmed)) return "";
	if (/^while\b.+do\s+end$/.test(trimmed)) return "";
	if (/^repeat\s+until\b/.test(trimmed) && /\buntil\s+true\s*$/.test(trimmed)) return "";
	return null;
};

const fixLine = (line: string, diagnostic: Diagnostic): string | null => {
	const code = diagnostic.rule.replace(/^luacheck\//, "");
	const normalized = normalizeCode(code);
	const name = extractQuotedName(diagnostic.message);

	switch (normalized) {
		case "211":
		case "212":
		case "213":
		case "231":
		case "232":
		case "233":
			return name ? prefixIdentifier(line, name) : null;
		case "111":
			return name ? fixUndefinedGlobal(line, name) : null;
		case "131":
			return name && isUnusedGlobalAssignment(line, name) ? "" : null;
		case "511":
			return "";
		case "521":
			return name ? fixUnusedLabel(line, name) : null;
		case "541":
		case "542":
			return fixEmptyBlockLine(line);
		case "551":
			return /^\s*;\s*$/.test(line) ? "" : null;
		case "581":
		case "582":
			return fixNegatedRelation(line);
		case "611":
			return /^\s*$/.test(line) ? "" : null;
		case "612":
		case "614":
			return line.trimEnd() === line ? null : line.trimEnd();
		default:
			return null;
	}
};

export const applyLuacheckFixes = (
	content: string,
	diagnostics: Diagnostic[],
): { content: string; changed: boolean } => {
	const lines = content.split("\n");
	const { lines: fixed, changed } = applyDiagnosticFixes(lines, diagnostics);
	return { content: fixed.join("\n"), changed };
};

const applyDiagnosticFixes = (
	lines: string[],
	diagnostics: Diagnostic[],
): { lines: string[]; changed: boolean } => {
	const byLine = new Map<number, Diagnostic[]>();
	for (const d of diagnostics) {
		if (!isLuacheckFixable(d.rule.replace(/^luacheck\//, ""))) continue;
		const list = byLine.get(d.line) ?? [];
		list.push(d);
		byLine.set(d.line, list);
	}

	const next = [...lines];
	let changed = false;
	const removed = new Set<number>();

	for (const [lineNo, lineDiagnostics] of byLine) {
		const idx = lineNo - 1;
		if (idx < 0 || idx >= next.length || removed.has(idx)) continue;
		let line = next[idx];
		for (const diagnostic of lineDiagnostics) {
			const fixed = fixLine(line, diagnostic);
			if (fixed === null) continue;
			if (fixed === "") {
				removed.add(idx);
				changed = true;
				break;
			}
			line = fixed;
			changed = true;
		}
		if (!removed.has(idx)) next[idx] = line;
	}

	if (!changed) return { lines: next, changed: false };
	const filtered = next.filter((_, i) => !removed.has(i));
	return { lines: filtered, changed: true };
};

export const fixLuacheck = async (context: EngineContext): Promise<void> => {
	for (let pass = 0; pass < 3; pass++) {
		const diagnostics = (await runLuacheck(context)).filter((d) =>
			isLuacheckFixable(d.rule.replace(/^luacheck\//, "")),
		);
		if (diagnostics.length === 0) return;

		const byFile = new Map<string, Diagnostic[]>();
		for (const d of diagnostics) {
			const absolute = path.isAbsolute(d.filePath)
				? d.filePath
				: path.join(context.rootDirectory, d.filePath);
			const list = byFile.get(absolute) ?? [];
			list.push(d);
			byFile.set(absolute, list);
		}

		let anyChanged = false;
		for (const [filePath, fileDiagnostics] of byFile) {
			if (!fs.existsSync(filePath)) continue;
			const content = fs.readFileSync(filePath, "utf-8");
			const { content: fixed, changed } = applyLuacheckFixes(content, fileDiagnostics);
			if (!changed) continue;
			fs.writeFileSync(filePath, fixed);
			anyChanged = true;
		}

		if (!anyChanged) return;
	}
};
