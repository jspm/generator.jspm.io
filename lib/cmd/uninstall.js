import { baseUrl } from '../common/url.js';
import { updatePjson } from "../install/pjson.js";
import TraceMap from '../tracemap/tracemap.js';
export async function uninstall(names) {
    if (typeof names === 'string')
        names = [names];
    const changed = await updatePjson(baseUrl.href, pjson => {
        for (const name of names) {
            if (pjson.dependencies?.[name])
                delete pjson.dependencies[name];
            if (pjson.devDependencies?.[name])
                delete pjson.devDependencies[name];
            if (pjson.optionalDependencies?.[name])
                delete pjson.optionalDependencies[name];
            if (pjson.peerDependencies?.[name])
                delete pjson.peerDependencies[name];
        }
    });
    if (changed) {
        const traceMap = new TraceMap(baseUrl, { prune: true });
        const finishInstall = await traceMap.startInstall();
        try {
            await finishInstall(true);
            return changed;
        }
        catch (e) {
            await finishInstall(false);
            throw e;
        }
    }
    return changed;
}
//# sourceMappingURL=uninstall.js.map