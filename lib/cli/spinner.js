import chalk from 'chalk';
import { logStream } from "../common/log.js";
let _isCygwin;
function isCygwin() {
    _isCygwin = false;
    if (typeof _isCygwin === 'boolean')
        return _isCygwin;
    try {
        if (require('child_process').execSync('uname -s', { stdio: 'pipe' }).toString().match(/^(CYGWIN|MINGW32|MINGW64)/))
            return _isCygwin = true;
    }
    catch (e) { }
    return _isCygwin = false;
}
export async function startSpinnerLog(log) {
    let spinner;
    if (!log) {
        let ora;
        // @ts-ignore
        if (typeof Deno !== 'undefined') {
            ({ wait: ora } = await import(eval('"https://deno.land/x/wait/mod.ts"')));
        }
        else {
            ({ default: ora } = await import(true ? 'ora' : ''));
        }
        spinner = ora({
            color: 'yellow',
            spinner: {
                interval: isCygwin() ? 7 : 100,
                frames: [".   ", ".   ", "..  ", "..  ", "... ", "... ", " ...", " ...", "  ..", "  ..", "   .", "   .", "    ", "    ", "    ", "    "].map(x => isCygwin() ? [x, x, x, x, x, x, x, x, x, x] : x).flat()
            }
        });
        (async () => {
            for await (const log of logStream()) {
                if (log.type === 'info') {
                    const spinning = spinner.isSpinning;
                    if (spinning)
                        spinner.stop();
                    console.error(`${chalk.cyan('info')} ${log.message}`);
                    if (spinning)
                        spinner.start();
                }
                else if (log.type === 'warn') {
                    const spinning = spinner.isSpinning;
                    if (spinning)
                        spinner.stop();
                    console.error(`${chalk.yellow('warn')} ${log.message}`);
                    if (spinning)
                        spinner.start();
                }
            }
        })().catch(e => {
            throw `${chalk.bold.red('err')}  ${e.message}`;
        });
        spinner.start();
    }
    else {
        spinner = {
            stop() { }
        };
        (async () => {
            const debugTypes = typeof log === 'string' ? log.split(',') : [];
            for await (const log of logStream()) {
                if (!log)
                    return;
                if (log.type === 'info') {
                    console.error(`${chalk.cyan('info')} ${log.message}`);
                }
                else if (log.type === 'warn') {
                    console.error(`${chalk.yellow('warn')} ${log.message}`);
                }
                else if (debugTypes.length === 0 || debugTypes.indexOf(log.type) !== -1) {
                    console.error(`${chalk.gray(log.type)}: ${log.message}`);
                }
            }
        })().catch(e => {
            throw `${chalk.bold.red('err')}  ${e.message}`;
        });
    }
    return spinner;
}
//# sourceMappingURL=spinner.js.map