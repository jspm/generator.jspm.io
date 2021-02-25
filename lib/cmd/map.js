import TraceMap from '../tracemap/tracemap.js';
import { baseUrl } from '../common/url.js';
import { isPackageTarget, toPackageTarget } from "../install/package.js";
// @ts-ignore
import { pathToFileURL } from 'url';
// @ts-ignore
import process from 'process';
// @ts-ignore
import { readFileSync } from 'fs';
export async function map(modules, opts) {
    if (typeof modules === 'string')
        modules = [modules];
    // @ts-ignore
    opts = { ...opts, save: opts.lock && !opts.freeze };
    // @ts-ignore
    if (typeof opts.inputMap === 'string')
        // @ts-ignore
        opts.inputMap = JSON.parse(readFileSync(opts.inputMap).toString());
    const traceMap = new TraceMap(baseUrl, opts);
    const finishInstall = await traceMap.startInstall();
    try {
        await Promise.all(modules.map(async (targetStr) => {
            let module;
            if (isPackageTarget(targetStr)) {
                const { alias, target, subpath } = await toPackageTarget(targetStr, pathToFileURL(process.cwd() + '/').href);
                await traceMap.add(alias, target);
                module = alias + subpath.slice(1);
            }
            else {
                module = new URL(targetStr, baseUrl).href;
            }
            return traceMap.trace(module);
        }));
        var changed = await finishInstall(true);
        const map = traceMap.map;
        map.flatten();
        map.rebase();
        map.sort();
        let systemBabel = false;
        const { system, esm } = traceMap.checkTypes();
        // @ts-ignore
        if (system || opts.system) {
            // @ts-ignore
            opts.system = true;
            systemBabel = esm;
        }
        let preloads;
        if (opts.preload || opts.integrity)
            preloads = traceMap.getPreloads(!!opts.integrity, baseUrl);
        // @ts-ignore
        if (opts.system)
            map.replace('https://ga.jspm.io/', new URL('https://ga.system.jspm.io/'));
        let output;
        if (!opts.out || !opts.out.endsWith('.html')) {
            output = map.toString(opts.minify);
        }
        else {
            const html = readFileSync(opts.out).toString();
            // @ts-ignore
            const { inject } = await import('../inject/map.ts');
            // @ts-ignore
            const system = opts.system ? { url: '/system.js' } : null;
            output = inject(html, {
                importMap: map.toJSON(),
                preloads,
                system,
                systemBabel: systemBabel ? { url: '/system-babel.js' } : null
            });
        }
        return { changed, output };
    }
    catch (e) {
        finishInstall(false);
        throw e;
    }
}
//# sourceMappingURL=map.js.map