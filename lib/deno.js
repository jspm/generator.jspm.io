#!/usr/bin/env -S deno run --allow-all --no-check --unstable --importmap /home/guybedford/Projects/jspm/jspm.importmap
import './deps.d.ts';
import { cli } from './cli.js';
export * from './api.js';
// CLI
// @ts-ignore
if (import.meta.main) {
    // @ts-ignore
    const [cmd, ...rawArgs] = Deno.args;
    const code = await cli(cmd, rawArgs);
    // @ts-ignore
    Deno.exit(code);
}
//# sourceMappingURL=deno.js.map