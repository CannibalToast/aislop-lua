/** Append items one by one. Spreading large arrays into `push()` overflows the V8 argument limit. */
export const appendAll = <T>(target: T[], items: readonly T[]): void => {
	for (const item of items) target.push(item);
};
