import resolver from "../install/resolver.js";
// @ts-ignore
import { pathToFileURL, fileURLToPath } from 'url';
// @ts-ignore
import { existsSync } from 'fs';
// @ts-ignore
import process from 'process';
export async function info(path = process.cwd() + '/') {
    const parentPkgUrl = await resolver.getPackageBase(pathToFileURL(path).href);
    const parentPkgPath = fileURLToPath(parentPkgUrl);
    const pjson = parentPkgPath + 'package.json';
    const lock = parentPkgPath + 'jspm.lock';
    return {
        projectPath: parentPkgPath,
        packageJSON: existsSync(pjson) ? true : false,
        lockFile: existsSync(lock) ? true : false
    };
}
//# sourceMappingURL=info.js.map