import { createHash } from 'crypto';
import TraceMap from '../tracemap/tracemap.js';
import { baseUrl } from '../common/url.js';
// @ts-ignore
import { readFileSync, writeFileSync } from 'fs';
import { runCmd } from '../common/cmd.js';
import { isPackageTarget, toPackageTarget } from "../install/package.js";
// @ts-ignore
import process from 'process';
// @ts-ignore
import { pathToFileURL } from 'url';
function computeMapHash(projectBase, moduleUrl) {
    const mapPrefix = createHash('sha256').update(moduleUrl).digest().toString('base64').replace(/\//g, '-').slice(0, 8);
    try {
        var mapSuffix = createHash('sha256').update(readFileSync(projectBase + '/package.json')).update(readFileSync(projectBase + '/jspm.lock')).digest().toString('base64').replace(/\//g, '-').slice(0, 16);
    }
    catch {
        return {};
    }
    return { mapPrefix, mapSuffix };
}
export async function deno(targetStr, flags = [], args = [], opts = {}) {
    opts = Object.assign({}, opts);
    opts.env = opts.env || [];
    if (!opts.env.includes('deno'))
        opts.env.push('deno');
    if (!opts.env.includes('browser'))
        opts.env.push('browser');
    if (!opts.env.includes('node'))
        opts.env.push('node');
    const tmpDir = '/tmp'; // os.tmpdir();
    let mapFile;
    if (opts.freeze) {
        const { mapPrefix, mapSuffix } = computeMapHash(process.cwd(), targetStr);
        if (mapSuffix) {
            try {
                // @ts-ignore
                const existingMap = readFileSync(tmpDir + '/' + mapPrefix + '-' + mapSuffix + '.importmap').toString();
                // JSON.parse(existingMap);
                mapFile = tmpDir + '/' + mapPrefix + '-' + mapSuffix + '.importmap';
            }
            catch { }
            if (mapFile)
                return await runCmd(`deno run --unstable --importmap ${mapFile} ${flags.join(' ')} ${targetStr} ${args.join(' ')}`);
        }
    }
    const traceMap = new TraceMap(baseUrl, opts);
    const finishInstall = await traceMap.startInstall();
    try {
        let module;
        if (isPackageTarget(targetStr)) {
            const { alias, target, subpath } = await toPackageTarget(targetStr, pathToFileURL(process.cwd() + '/').href);
            await traceMap.add(alias, target);
            module = alias + subpath.slice(1);
        }
        else {
            module = new URL(targetStr, baseUrl).href;
        }
        var resolved = await traceMap.trace(module);
        await finishInstall(true);
    }
    catch (e) {
        finishInstall(false);
        throw e;
    }
    const map = traceMap.map.toString();
    const { mapPrefix, mapSuffix } = computeMapHash(process.cwd(), targetStr);
    mapFile = tmpDir + '/' + mapPrefix + '-' + mapSuffix + '.importmap';
    writeFileSync(mapFile, map);
    const code = await runCmd(`deno run --unstable --importmap ${mapFile} ${flags.join(' ')} ${resolved} ${args.join(' ')}`);
    return code;
}
//# sourceMappingURL=deno.js.map