// @ts-ignore
import sver from 'sver';
const { Semver } = sver;
import { log } from '../common/log.js';
// @ts-ignore
import { builtinModules } from 'module';
// @ts-ignore
import { fileURLToPath } from 'url';
import * as lock from "./lock.js";
import resolver from "./resolver.js";
import { newPackageTarget } from "./package.js";
import { isURL, importedFrom } from "../common/url.js";
import { JspmError, throwInternalError } from "../common/err.js";
import { updatePjson } from './pjson.js';
import path from 'path';
export const builtinSet = new Set(builtinModules);
;
export class Installer {
    constructor(baseUrl, opts) {
        this.installing = false;
        this.newInstalls = false;
        this.currentInstall = Promise.resolve();
        // @ts-ignore
        this.stdlibTarget = new URL('../../core/dist', import.meta.url);
        this.added = new Map();
        this.hasLock = false;
        this.installBaseUrl = baseUrl.href;
        this.opts = opts;
        this.lockfilePath = fileURLToPath(this.installBaseUrl + 'jspm.lock');
        const { resolutions, exists: hasLock } = lock.loadVersionLock(this.lockfilePath);
        this.hasLock = hasLock;
        this.installs = resolutions;
        if (opts.stdlib) {
            if (isURL(opts.stdlib) || opts.stdlib[0] === '.') {
                this.stdlibTarget = new URL(opts.stdlib, baseUrl);
                if (this.stdlibTarget.href.endsWith('/'))
                    this.stdlibTarget.pathname = this.stdlibTarget.pathname.slice(0, -1);
            }
            else {
                this.stdlibTarget = newPackageTarget(opts.stdlib, this.installBaseUrl);
            }
        }
    }
    async startInstall() {
        if (this.installing)
            return this.currentInstall.then(() => this.startInstall());
        let finishInstall;
        this.installing = true;
        this.newInstalls = false;
        this.added = new Map();
        this.currentInstall = new Promise(resolve => {
            finishInstall = async (success) => {
                if (!success) {
                    this.installing = false;
                    resolve();
                    return false;
                }
                const save = this.opts.save || this.opts.saveDev || this.opts.savePeer || this.opts.saveOptional || this.hasLock || this.opts.lock;
                // update the package.json dependencies
                let pjsonChanged = false;
                const saveField = this.opts.saveDev ? 'devDependencies' : this.opts.savePeer ? 'peerDependencies' : this.opts.saveOptional ? 'optionalDependencies' : 'dependencies';
                if (saveField && save) {
                    pjsonChanged = await updatePjson(this.installBaseUrl, async (pjson) => {
                        pjson[saveField] = pjson[saveField] || {};
                        for (const [name, target] of this.added) {
                            if (target instanceof URL) {
                                if (target.protocol === 'file:') {
                                    pjson[saveField][name] = 'file:' + path.relative(fileURLToPath(this.installBaseUrl), fileURLToPath(target));
                                }
                                else {
                                    pjson[saveField][name] = target.href;
                                }
                            }
                            else {
                                let versionRange = target.ranges.map(range => range.toString()).join(' || ');
                                if (versionRange === '*') {
                                    const pcfg = await resolver.getPackageConfig(this.installs[this.installBaseUrl][target.name]);
                                    if (pcfg)
                                        versionRange = '^' + pcfg?.version;
                                }
                                pjson[saveField][name] = (target.name === name ? '' : target.registry + ':' + target.name + '@') + versionRange;
                            }
                        }
                    });
                }
                // prune the lockfile to the include traces only
                // this is done after pjson updates to include any adds
                if (this.opts.prune || pjsonChanged) {
                    const deps = await resolver.getDepList(this.installBaseUrl, true);
                    // existing deps is any existing builtin resolutions
                    const existingBuiltins = new Set(Object.keys(this.installs[this.installBaseUrl] || {}).filter(name => builtinSet.has(name)));
                    await this.lockInstall([...new Set([...deps, ...existingBuiltins])], this.installBaseUrl, true);
                }
                const lockChanged = this.hasLock || this.opts.lock ? lock.saveVersionLock(this.installs, this.lockfilePath) : false;
                this.installing = false;
                resolve();
                return pjsonChanged || lockChanged;
            };
        });
        return finishInstall;
    }
    async lockInstall(installs, pkgUrl = this.installBaseUrl, prune = true) {
        const visited = new Set();
        const visitInstall = async (name, pkgUrl) => {
            if (visited.has(name + '##' + pkgUrl))
                return;
            visited.add(name + '##' + pkgUrl);
            const installUrl = await this.install(name, pkgUrl);
            const installPkgUrl = installUrl.split('|')[0] + (installUrl.indexOf('|') === -1 ? '' : '/');
            const deps = await resolver.getDepList(installPkgUrl);
            const existingDeps = Object.keys(this.installs[installPkgUrl] || {});
            await Promise.all([...new Set([...deps, ...existingDeps])].map(dep => visitInstall(dep, installPkgUrl)));
        };
        await Promise.all(installs.map(install => visitInstall(install, pkgUrl)));
        if (prune) {
            const pruneList = [...visited].map(item => {
                const [name, pkgUrl] = item.split('##');
                return [name, pkgUrl];
            });
            this.installs = lock.pruneResolutions(this.installs, pruneList);
        }
    }
    replace(target, replacePkgUrl) {
        let targetUrl;
        if (target instanceof URL) {
            targetUrl = target.href;
        }
        else {
            const pkg = this.getBestMatch(target);
            if (!pkg) {
                if (this.installs[replacePkgUrl])
                    return false;
                throw new Error('No installation found to replace.');
            }
            targetUrl = resolver.pkgToUrl(pkg);
        }
        let replaced = false;
        for (const pkgUrl of Object.keys(this.installs)) {
            for (const name of Object.keys(this.installs[pkgUrl])) {
                if (this.installs[pkgUrl][name] === targetUrl) {
                    this.installs[pkgUrl][name] = replacePkgUrl;
                    replaced = true;
                }
            }
            if (pkgUrl === targetUrl) {
                this.installs[replacePkgUrl] = this.installs[pkgUrl];
                delete this.installs[pkgUrl];
                replaced = true;
            }
        }
        return replaced;
    }
    async installTarget(pkgName, target, pkgScope, pjsonPersist, parentUrl = pkgScope) {
        if (this.opts.freeze)
            throw new JspmError(`"${pkgName}" is not installed in the jspm lockfile, imported from ${parentUrl}.`, 'ERR_NOT_INSTALLED');
        this.newInstalls = true;
        if (pjsonPersist) {
            if (pkgScope === this.installBaseUrl && pkgScope.startsWith('file:')) {
                this.added.set(pkgName, target);
            }
            else {
                log('info', `Package ${pkgName} not declared in package.json dependencies${importedFrom(parentUrl)}.`);
            }
        }
        if (target instanceof URL) {
            log('install', `${pkgName} ${pkgScope} -> ${target.href}`);
            const pkgUrl = target.href + (target.href.endsWith('/') ? '' : '/');
            lock.setResolution(this.installs, pkgName, pkgScope, pkgUrl);
            return pkgUrl;
        }
        if (this.opts.freeze) {
            const existingInstall = this.getBestMatch(target);
            if (existingInstall) {
                log('install', `${pkgName} ${pkgScope} -> ${existingInstall.registry}:${existingInstall.name}@${existingInstall.version}`);
                const pkgUrl = resolver.pkgToUrl(existingInstall);
                lock.setResolution(this.installs, pkgName, pkgScope, pkgUrl);
                return pkgUrl;
            }
        }
        const latest = await resolver.resolveLatestTarget(target, false, parentUrl);
        const installed = await this.getInstalledPackages(target);
        const restrictedToPkg = await this.tryUpgradePackagesTo(latest, installed);
        // cannot upgrade to latest -> stick with existing resolution (if compatible)
        if (restrictedToPkg && !this.opts.latest) {
            log('install', `${pkgName} ${pkgScope} -> ${restrictedToPkg.registry}:${restrictedToPkg.name}@${restrictedToPkg.version}`);
            const pkgUrl = resolver.pkgToUrl(restrictedToPkg);
            lock.setResolution(this.installs, pkgName, pkgScope, pkgUrl);
            return pkgUrl;
        }
        log('install', `${pkgName} ${pkgScope} -> ${latest.registry}:${latest.name}@${latest.version}`);
        const pkgUrl = resolver.pkgToUrl(latest);
        lock.setResolution(this.installs, pkgName, pkgScope, pkgUrl);
        return pkgUrl;
    }
    async install(pkgName, pkgUrl, parentUrl = this.installBaseUrl) {
        if (!this.installing)
            throwInternalError();
        if (!this.opts.reset) {
            const existingUrl = this.installs[pkgUrl]?.[pkgName];
            if (existingUrl && !this.opts.reset)
                return existingUrl;
        }
        const pcfg = await resolver.getPackageConfig(pkgUrl) || {};
        // package dependencies
        const installTarget = pcfg.dependencies?.[pkgName] || pcfg.peerDependencies?.[pkgName] || pcfg.optionalDependencies?.[pkgName] || pcfg.devDependencies?.[pkgName];
        if (installTarget) {
            const target = newPackageTarget(installTarget, pkgUrl, pkgName);
            return this.installTarget(pkgName, target, pkgUrl, false, parentUrl);
        }
        // node.js core
        if (builtinSet.has(pkgName)) {
            const target = this.stdlibTarget;
            const resolution = (await this.installTarget(pkgName, target, pkgUrl, false, parentUrl)).slice(0, -1) + '|nodelibs/' + pkgName;
            lock.setResolution(this.installs, pkgName, pkgUrl, resolution);
            return resolution;
        }
        // global install fallback
        const target = newPackageTarget('*', pkgUrl, pkgName);
        const exactInstall = await this.installTarget(pkgName, target, pkgUrl, true, parentUrl);
        return exactInstall;
    }
    async getInstalledPackages(_pkg) {
        // TODO: to finish up version deduping algorithm, we need this
        // operation to search for all existing installs in this.installs
        // that have a target matching the given package
        // This is done by checking their package.json and seeing if the package.json target range
        // contains this target range
        return [];
    }
    getBestMatch(matchPkg) {
        let bestMatch = null;
        for (const pkgUrl of Object.keys(this.installs)) {
            const pkg = resolver.parseUrlPkg(pkgUrl);
            if (pkg && this.inRange(pkg, matchPkg)) {
                if (bestMatch)
                    bestMatch = Semver.compare(new Semver(bestMatch.version), pkg.version) === -1 ? pkg : bestMatch;
                else
                    bestMatch = pkg;
            }
        }
        return bestMatch;
    }
    inRange(pkg, target) {
        return pkg.registry === target.registry && pkg.name === target.name && target.ranges.some(range => range.has(pkg.version, true));
    }
    // upgrade any existing packages to this package if possible
    tryUpgradePackagesTo(pkg, installed) {
        if (this.opts.freeze)
            return;
        const pkgVersion = new Semver(pkg.version);
        let hasUpgrade = false;
        for (const version of new Set(installed.map(({ pkg }) => pkg.version))) {
            let hasVersionUpgrade = true;
            for (const { pkg, target } of installed) {
                if (pkg.version !== version)
                    continue;
                // user out-of-version lock
                if (!this.opts.reset && !target.ranges.some(range => range.has(pkg.version, true))) {
                    hasVersionUpgrade = false;
                    continue;
                }
                if (pkgVersion.lt(pkg.version) || !target.ranges.some(range => range.has(pkgVersion, true))) {
                    hasVersionUpgrade = false;
                    continue;
                }
            }
            if (hasVersionUpgrade)
                hasUpgrade = true;
            if (hasUpgrade || this.opts.latest) {
                for (const { pkg, install } of installed) {
                    if (pkg.version !== version)
                        continue;
                    lock.setResolution(this.installs, install.name, install.pkgUrl, resolver.pkgToUrl(pkg));
                }
            }
        }
    }
}
//# sourceMappingURL=installer.js.map