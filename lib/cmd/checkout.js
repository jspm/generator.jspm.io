import TraceMap from '../tracemap/tracemap.js';
import { baseUrl } from '../common/url.js';
import { toPackageTarget } from "../install/package.js";
// @ts-ignore
import { pathToFileURL } from 'url';
// @ts-ignore
import process from 'process';
import { JspmError } from '../common/err.js';
import resolver from '../install/resolver.js';
// @ts-ignore
import { fileURLToPath } from 'url';
// @ts-ignore
export async function checkout(targetStr, depsDir = 'deps', beautify = false) {
    // @ts-ignore
    const traceMap = new TraceMap(baseUrl, { install: true, save: true });
    const finishInstall = await traceMap.startInstall();
    try {
        const { alias, target, subpath } = await toPackageTarget(targetStr, pathToFileURL(process.cwd() + '/').href);
        const pkgUrl = await traceMap.add(alias, target, false);
        if (subpath !== '.')
            throw new JspmError(`Cannot checkout a subpath of a package.`);
        const checkoutUrl = new URL(depsDir + '/' + alias + '/', baseUrl);
        await resolver.dlPackage(pkgUrl, fileURLToPath(checkoutUrl));
        const replaced = traceMap.replace(target, checkoutUrl.href);
        if (!replaced)
            return null;
        const didCheckOut = await finishInstall(true);
        if (didCheckOut)
            return checkoutUrl.href;
        return null;
    }
    catch (e) {
        finishInstall(false);
        throw e;
    }
}
//# sourceMappingURL=checkout.js.map