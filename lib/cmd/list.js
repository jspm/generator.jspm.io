import resolver from '../install/resolver.js';
import { toPackageTarget, pkgUrlToNiceString } from '../install/package.js';
import { JspmError } from '../common/err.js';
// @ts-ignore
import { pathToFileURL } from 'url';
// @ts-ignore
import process from 'process';
export async function list(module) {
    const { target, subpath } = await toPackageTarget(module, pathToFileURL(process.cwd() + '/').href);
    let pkgUrl;
    if (!(target instanceof URL)) {
        const resolved = await resolver.resolveLatestTarget(target, false);
        pkgUrl = resolver.pkgToUrl(resolved);
    }
    else {
        pkgUrl = target.href;
    }
    const pcfg = await resolver.getPackageConfig(pkgUrl);
    if (!pcfg)
        throw new JspmError(`No package configuration found for ${pkgUrlToNiceString(pkgUrl)}.`);
    if (!pcfg.exports)
        throw new JspmError(`No package exports defined for package ${pkgUrlToNiceString(pkgUrl)}.`);
    let exports = typeof pcfg.exports === 'object' && !(pcfg.exports instanceof Array) && pcfg.exports !== null ? pcfg.exports : { '.': pcfg.exports };
    if (Object.keys(exports).every(key => key[0] !== '.'))
        exports = { '.': exports };
    const matches = Object.keys(exports).filter(key => key.startsWith(subpath) && !key.endsWith('!cjs'));
    if (!matches.length)
        throw new JspmError(`No exports matching ${subpath} in ${pkgUrlToNiceString(pkgUrl)}`);
    const filteredExports = {};
    for (const key of matches) {
        filteredExports[key] = exports[key];
    }
    return { resolved: pkgUrlToNiceString(pkgUrl.slice(0, -1)), exports: filteredExports };
}
//# sourceMappingURL=list.js.map