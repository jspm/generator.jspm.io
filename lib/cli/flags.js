import chalk from 'chalk';
import { JspmError } from "../common/err.js";
export function toCamelCase(name) {
    return name.split('-').map((part, i) => i === 0 ? part : part[0].toUpperCase() + part.slice(1)).join('');
}
export function fromCamelCase(name) {
    let outName = '';
    for (let i = 0; i < name.length; i++) {
        if (name[i].toUpperCase() === name[i])
            outName += '-' + name[i].toLowerCase();
        else
            outName += name[i];
    }
    return outName;
}
export function readFlags(rawArgs, { boolFlags = [], strFlags = [], arrFlags = [], aliases = {} } = {}) {
    const args = [], opts = {};
    let readArg = null, maybeBool = false;
    for (const arg of rawArgs) {
        if (readArg) {
            if (arg.startsWith('-')) {
                if (!maybeBool)
                    throw new JspmError(`Flag value for ${chalk.bold(`--${readArg}`)} not specified`);
            }
            else {
                if (Array.isArray(opts[readArg]))
                    opts[readArg].push(arg);
                else
                    opts[readArg] = arg;
                readArg = null;
                continue;
            }
        }
        if (arg.startsWith('--')) {
            const eqIndex = arg.indexOf('=');
            const boolFlag = boolFlags.includes(arg.substr(2));
            const strFlag = strFlags.includes(arg.slice(2, eqIndex === -1 ? arg.length : eqIndex));
            const arrFlag = arrFlags.includes(arg.slice(2, eqIndex === -1 ? arg.length : eqIndex));
            if (boolFlag) {
                opts[toCamelCase(arg.substr(2))] = true;
            }
            else if (strFlag || arrFlag) {
                if (eqIndex === -1) {
                    readArg = toCamelCase(arg.slice(2));
                    if (arrFlag)
                        opts[readArg] = opts[readArg] || [];
                    maybeBool = boolFlag;
                }
                else {
                    if (arrFlag)
                        (opts[toCamelCase(arg.slice(2, eqIndex))]).push(arg.slice(eqIndex + 1));
                    else
                        opts[toCamelCase(arg.slice(2, eqIndex))] = arg.slice(eqIndex + 1);
                }
            }
            else {
                throw new JspmError(`Unknown flag ${chalk.bold(arg)}`);
            }
        }
        else if (arg.startsWith('-')) {
            const hasEq = arg[2] === '=';
            const alias = aliases[arg.slice(1, 2)];
            const boolFlag = alias && !hasEq && boolFlags.find(f => f === alias);
            const strFlag = strFlags.find(f => f === alias);
            const arrFlag = arrFlags.find(f => f === alias);
            if (boolFlag) {
                opts[toCamelCase(boolFlag)] = true;
                for (const c of arg.slice(2)) {
                    const alias = aliases[c];
                    const boolFlag = alias && boolFlags.find(f => f === alias);
                    if (!boolFlag) {
                        throw new JspmError(`Unknown boolean flag ${chalk.bold(c)} in set ${arg}`);
                    }
                    opts[toCamelCase(boolFlag)] = true;
                }
            }
            if (strFlag || arrFlag) {
                if (arrFlag)
                    opts[toCamelCase(arrFlag)] = opts[toCamelCase(arrFlag)] || [];
                if (arg.length === 2) {
                    readArg = toCamelCase((strFlag || arrFlag));
                    maybeBool = boolFlag;
                }
                else {
                    if (arrFlag)
                        opts[toCamelCase(arrFlag)].push(arg.slice(2 + (hasEq ? 1 : 0)));
                    else
                        opts[toCamelCase(strFlag)] = arg.slice(2 + (hasEq ? 1 : 0));
                }
            }
            if (!boolFlag && !strFlag && !arrFlag)
                throw new JspmError(`Unknown flag ${chalk.bold(arg)}`);
        }
        else {
            args.push(arg);
        }
    }
    if (readArg && !maybeBool)
        throw new JspmError(`Flag value for ${chalk.bold(`--${readArg}`)} not specified`);
    return { args, opts };
}
//# sourceMappingURL=flags.js.map