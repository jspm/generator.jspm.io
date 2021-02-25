import { baseUrl, importedFrom, isPlain, relativeUrl } from "../common/url.js";
import { Installer } from "../install/installer.js";
import { log } from "../common/log.js";
import { JspmError, throwInternalError } from "../common/err.js";
import { parsePkg } from "../install/package.js";
import { getMapMatch, getScopeMatches, ImportMap } from "./map.js";
import resolver from "../install/resolver.js";
// The tracemap fully drives the installer
export default class TraceMap {
    constructor(mapBase, opts = {}) {
        this.env = ['browser', 'development'];
        this.tracedUrls = {};
        this.traces = new Set();
        this.staticList = new Set();
        this.dynamicList = new Set();
        this.mapBase = mapBase;
        this.opts = opts;
        if (this.opts.env)
            this.env = this.opts.env;
        if (opts.inputMap)
            this.map = opts.inputMap instanceof ImportMap ? opts.inputMap : new ImportMap(mapBase).extend(opts.inputMap);
        else
            this.map = new ImportMap(mapBase);
    }
    replace(target, pkgUrl) {
        return this.installer.replace(target, pkgUrl);
    }
    async visit(url, visitor, seen = new Set()) {
        if (seen.has(url))
            return;
        seen.add(url);
        const entry = this.tracedUrls[url];
        if (!entry)
            return;
        for (const dep of Object.keys(entry.deps)) {
            await this.visit(entry.deps[dep], visitor, seen);
        }
        await visitor(url, entry);
    }
    getPreloads(integrity, baseUrl) {
        return [...this.staticList].map(url => {
            const relUrl = relativeUrl(new URL(url), baseUrl);
            return {
                url: relUrl.startsWith('./') ? relUrl.slice(2) : relUrl,
                integrity: integrity ? this.tracedUrls[url].integrity : false,
                jspm: !url.startsWith('https://ga.jspm.io/') && !url.startsWith('https://system.ga.jspm.io/')
            };
        });
    }
    checkTypes() {
        let system = false, esm = false;
        for (const url of [...this.staticList, ...this.dynamicList]) {
            const trace = this.tracedUrls[url];
            if (trace.system)
                system = true;
            else
                esm = true;
        }
        return { system, esm };
    }
    async startInstall() {
        this.pjsonBase = this.pjsonBase || new URL((await resolver.getPackageBase(this.mapBase.href)) || baseUrl.href);
        if (!this.installer) {
            if (!this.pjsonBase)
                log('warn', 'No project package.json found, create a package.json file to define install resolution targets for updating or publishing.');
            this.installer = new Installer(this.pjsonBase || baseUrl, this.opts);
        }
        const finishInstall = await this.installer.startInstall();
        return async (success) => {
            if (!success) {
                finishInstall(false);
                return false;
            }
            // re-drive all the traces to convergence
            if (!this.opts.fullMap) {
                const traceResolutions = {};
                do {
                    this.installer.newInstalls = false;
                    await Promise.all([...this.traces].map(async (trace) => {
                        const [specifier, parentUrl] = trace.split('##');
                        const resolved = await this.trace(specifier, new URL(parentUrl));
                        traceResolutions[trace] = resolved;
                    }));
                } while (this.installer.newInstalls);
                // now second-pass visit the trace to gather the exact graph and collect the import map
                let list = this.staticList;
                const discoveredDynamics = new Set();
                const depVisitor = async (url, entry) => {
                    list.add(url);
                    const parentPkgUrl = await resolver.getPackageBase(url);
                    for (const dep of Object.keys(entry.dynamicDeps)) {
                        const resolvedUrl = entry.dynamicDeps[dep][0];
                        if (isPlain(dep))
                            this.map.addMapping(dep, resolvedUrl, parentPkgUrl);
                        discoveredDynamics.add(resolvedUrl);
                    }
                    for (const dep of Object.keys(entry.deps)) {
                        if (isPlain(dep))
                            this.map.addMapping(dep, entry.deps[dep], parentPkgUrl);
                    }
                };
                const seen = new Set();
                for (const trace of this.traces) {
                    const url = traceResolutions[trace];
                    const [specifier, parentUrl] = trace.split('##');
                    if (isPlain(specifier) && parentUrl === this.mapBase.href)
                        this.map.addMapping(specifier, url);
                    await this.visit(url, depVisitor, seen);
                }
                list = this.dynamicList;
                for (const url of discoveredDynamics) {
                    await this.visit(url, depVisitor, seen);
                }
            }
            return finishInstall(true);
        };
    }
    async add(name, target, persist = true) {
        const installed = await this.installer.installTarget(name, target, this.mapBase.href, persist);
        return installed.slice(0, -1);
    }
    async addAllPkgMappings(name, pkgUrl, env, parentPkgUrl) {
        const [url, subpathFilter] = pkgUrl.split('|');
        const exports = await resolver.resolveExports(url + (url.endsWith('/') ? '' : '/'), env, subpathFilter);
        for (const key of Object.keys(exports)) {
            if (key.endsWith('!cjs'))
                continue;
            if (!exports[key])
                continue;
            if (key.endsWith('*'))
                continue;
            this.map.addMapping(name + key.slice(1), new URL(exports[key], url).href, parentPkgUrl);
        }
    }
    async trace(specifier, parentUrl = this.mapBase, env = ['import', ...this.env]) {
        const parentPkgUrl = await resolver.getPackageBase(parentUrl.href);
        if (!parentPkgUrl)
            throwInternalError();
        this.traces.add(specifier + '##' + parentUrl.href);
        if (!isPlain(specifier)) {
            const resolvedUrl = new URL(specifier, parentUrl);
            if (resolvedUrl.protocol !== 'file:' && resolvedUrl.protocol !== 'https:' && resolvedUrl.protocol !== 'http:' && resolvedUrl.protocol !== 'node:' && resolvedUrl.protocol !== 'data:')
                throw new JspmError(`Found unexpected protocol ${resolvedUrl.protocol}${importedFrom(parentUrl)}`);
            log('trace', `${specifier} ${parentUrl.href} -> ${resolvedUrl}`);
            await this.traceUrl(resolvedUrl.href, parentUrl, env);
            return resolvedUrl.href;
        }
        const parsed = parsePkg(specifier);
        if (!parsed)
            throw new JspmError(`Invalid package name ${specifier}`);
        const { pkgName, subpath } = parsed;
        // Subscope override
        const scopeMatches = getScopeMatches(parentUrl, this.map.scopes, this.map.baseUrl);
        const pkgSubscopes = scopeMatches.filter(([, url]) => url.startsWith(parentPkgUrl));
        if (pkgSubscopes.length) {
            for (const [scope] of pkgSubscopes) {
                const mapMatch = getMapMatch(specifier, this.map.scopes[scope]);
                if (mapMatch) {
                    const resolved = new URL(this.map.scopes[scope][mapMatch] + specifier.slice(mapMatch.length), this.map.baseUrl).href;
                    log('trace', `${specifier} ${parentUrl.href} -> ${resolved}`);
                    await this.traceUrl(resolved, parentUrl, env);
                    return resolved;
                }
            }
        }
        // Scope override
        const userScopeMatch = scopeMatches.find(([, url]) => url === parentPkgUrl);
        if (userScopeMatch) {
            const imports = this.map.scopes[userScopeMatch[0]];
            const userImportsMatch = getMapMatch(specifier, imports);
            const userImportsResolved = userImportsMatch ? new URL(imports[userImportsMatch] + specifier.slice(userImportsMatch.length), this.map.baseUrl).href : null;
            if (userImportsResolved) {
                log('trace', `${specifier} ${parentUrl.href} -> ${userImportsResolved}`);
                await this.traceUrl(userImportsResolved, parentUrl, env);
                return userImportsResolved;
            }
        }
        // @ts-ignore
        const installed = this.opts.freeze ? this.installer?.installs[parentPkgUrl]?.[pkgName] : await this.installer?.install(pkgName, parentPkgUrl, parentUrl.href);
        if (installed) {
            let [pkgUrl, subpathFilter] = installed.split('|');
            if (subpathFilter)
                pkgUrl += '/';
            const exports = await resolver.resolveExports(pkgUrl, env, subpathFilter);
            const match = getMapMatch(subpath, exports);
            if (!match)
                throw new JspmError(`No '${subpath}' exports subpath defined in ${pkgUrl} resolving ${pkgName}${importedFrom(parentUrl)}.`);
            if (match) {
                const resolved = new URL(exports[match] + subpath.slice(match.length), pkgUrl).href;
                log('trace', `${specifier} ${parentUrl.href} -> ${resolved}`);
                await this.traceUrl(resolved, parentUrl, env);
                return resolved;
            }
        }
        // User import overrides
        const userImportsMatch = getMapMatch(specifier, this.map.imports);
        const userImportsResolved = userImportsMatch ? new URL(this.map.imports[userImportsMatch] + specifier.slice(userImportsMatch.length), this.map.baseUrl).href : null;
        if (userImportsResolved) {
            log('trace', `${specifier} ${parentUrl.href} -> ${userImportsResolved}`);
            await this.traceUrl(userImportsResolved, parentUrl, env);
            return userImportsResolved;
        }
        throw new JspmError(`No resolution in map for ${specifier}${importedFrom(parentUrl)}`);
    }
    async traceUrl(resolvedUrl, parentUrl, env) {
        if (resolvedUrl in this.tracedUrls)
            return;
        if (resolvedUrl.endsWith('/'))
            throw new JspmError(`Trailing "/" installs not yet supported installing ${resolvedUrl} for ${parentUrl.href}`);
        const traceEntry = this.tracedUrls[resolvedUrl] = {
            deps: Object.create(null),
            dynamicDeps: Object.create(null),
            hasStaticParent: true,
            size: NaN,
            integrity: '',
            system: false,
            babel: false
        };
        const { deps, dynamicDeps, integrity, size, system } = await resolver.analyze(resolvedUrl, parentUrl, this.opts.system);
        traceEntry.integrity = integrity;
        traceEntry.system = !!system;
        traceEntry.size = size;
        let allDeps = deps;
        if (dynamicDeps.length && !this.opts.static) {
            allDeps = [...deps];
            for (const dep of dynamicDeps) {
                if (!allDeps.includes(dep))
                    allDeps.push(dep);
            }
        }
        const resolvedUrlObj = new URL(resolvedUrl);
        await Promise.all(allDeps.map(async (dep) => {
            const resolvedUrl = await this.trace(dep, resolvedUrlObj, env);
            if (deps.includes(dep))
                traceEntry.deps[dep] = resolvedUrl;
            if (dynamicDeps.includes(dep))
                traceEntry.dynamicDeps[dep] = [resolvedUrl];
        }));
    }
}
//# sourceMappingURL=tracemap.js.map