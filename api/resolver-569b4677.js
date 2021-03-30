import { readFileSync, existsSync, writeFileSync } from 'fs';
import { pathToFileURL, fileURLToPath } from 'url';
import process from 'process';
import path from 'path';
import { createHash } from 'crypto';
import { parse } from 'es-module-lexer';
import mkdirp from 'mkdirp';
import { Buffer } from 'buffer';
import sver from 'sver';
import convertRange from 'sver/convert-range';

// @ts-ignore
let baseUrl;
// @ts-ignore
if (typeof Deno !== 'undefined') {
    // @ts-ignore
    baseUrl = pathToFileURL(Deno.cwd() + '/');
}
else if (typeof process !== 'undefined' && process.versions.node) {
    baseUrl = new URL('file://' + process.cwd() + '/');
}
else if (typeof document !== 'undefined') {
    const baseEl = document.querySelector('base[href]');
    if (baseEl)
        baseUrl = new URL(baseEl.href + (baseEl.href.endsWith('/') ? '' : '/'));
    else if (typeof location !== 'undefined')
        baseUrl = new URL('../', new URL(location.href));
}
function importedFrom(parentUrl) {
    if (!parentUrl)
        return '';
    return ` imported from ${parentUrl}`;
}
function relativeUrl(url, baseUrl) {
    const href = url.href;
    const baseUrlHref = baseUrl.href;
    if (href.startsWith(baseUrlHref))
        return './' + href.slice(baseUrlHref.length);
    if (url.protocol !== baseUrl.protocol || url.host !== baseUrl.host || url.port !== baseUrl.port || url.username !== baseUrl.username || url.password !== baseUrl.password)
        return url.href;
    const baseUrlPath = baseUrl.pathname;
    const urlPath = url.pathname;
    const minLen = Math.min(baseUrlPath.length, urlPath.length);
    let sharedBaseIndex = -1;
    for (let i = 0; i < minLen; i++) {
        if (baseUrlPath[i] !== urlPath[i])
            break;
        if (urlPath[i] === '/')
            sharedBaseIndex = i;
    }
    return '../'.repeat(baseUrlPath.slice(sharedBaseIndex + 1).split('/').length - 1) + urlPath.slice(sharedBaseIndex + 1) + url.search + url.hash;
}
function isURL(specifier) {
    try {
        new URL(specifier);
    }
    catch {
        return false;
    }
    return true;
}
function isPlain(specifier) {
    return !isRelative(specifier) && !isURL(specifier);
}
function isRelative(specifier) {
    return specifier.startsWith('./') || specifier.startsWith('../') || specifier.startsWith('/');
}
function urlToNiceStr(url) {
    let relPath = path.relative(process.cwd(), fileURLToPath(url));
    if (relPath[0] !== '.')
        relPath = './' + relPath;
    return relPath;
}

let resolveQueue;
new Promise(resolve => resolveQueue = resolve);
let queue = [];
function log(type, message) {
    if (queue.length) {
        queue.push({ type, message });
    }
    else {
        queue = [{ type, message }];
        const _resolveQueue = resolveQueue;
        new Promise(resolve => resolveQueue = resolve);
        _resolveQueue();
    }
}

class JspmError extends Error {
    constructor(msg, code) {
        super(msg);
        this.jspmError = true;
        this.code = code;
    }
}
function throwInternalError() {
    throw new Error('Internal Error');
}

const version = 'jspm-deno-beta';

var _a, _b;
let _fetch;
if (typeof fetch !== 'undefined') {
    _fetch = fetch;
}
else if ((_b = (_a = globalThis === null || globalThis === void 0 ? void 0 : globalThis.process) === null || _a === void 0 ? void 0 : _a.versions) === null || _b === void 0 ? void 0 : _b.node) {
    // @ts-ignore
    const path = require('path');
    // @ts-ignore
    const home = require('os').homedir();
    // @ts-ignore
    const process = require('process');
    // @ts-ignore
    require('rimraf');
    // @ts-ignore
    const makeFetchHappen = require('make-fetch-happen');
    let cacheDir;
    if (process.platform === 'darwin')
        cacheDir = path.join(home, 'Library', 'Caches', 'jspm');
    else if (process.platform === 'win32')
        cacheDir = path.join(process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local'), 'jspm-cache');
    else
        cacheDir = path.join(process.env.XDG_CACHE_HOME || path.join(home, '.cache'), 'jspm');
    _fetch = makeFetchHappen.defaults({ cacheManager: path.join(cacheDir, 'fetch-cache'), headers: { 'User-Agent': `jspm/${version}` } });
}
else {
    throw new Error('No fetch implementation found for this environment, please post an issue.');
}
const __fetch = _fetch;
// @ts-ignore
_fetch = async function (url, ...args) {
    const urlString = url.toString();
    if (urlString.startsWith('file:') || urlString.startsWith('data:') || urlString.startsWith('node:')) {
        try {
            let source;
            if (urlString.startsWith('file:')) {
                source = readFileSync(fileURLToPath(urlString));
            }
            else if (urlString.startsWith('node:')) {
                source = '';
            }
            else {
                source = decodeURIComponent(urlString.slice(urlString.indexOf(',')));
            }
            return {
                status: 200,
                async text() {
                    return source.toString();
                },
                async json() {
                    return JSON.parse(source.toString());
                },
                arrayBuffer() {
                    return source;
                }
            };
        }
        catch (e) {
            if (e.code === 'EISDIR' || e.code === 'ENOTDIR')
                return { status: 404, statusText: e.toString() };
            if (e.code === 'ENOENT')
                return { status: 404, statusText: e.toString() };
            return { status: 500, statusText: e.toString() };
        }
    }
    // @ts-ignore
    if (typeof Deno !== 'undefined' /*&& args[0]?.cache === 'only-if-cached' */) {
        const { cache } = await import(eval('"../../deps/cache/mod.ts"'));
        try {
            const file = await cache(urlString);
            return {
                status: 200,
                async text() {
                    // @ts-ignore
                    return (await Deno.readTextFile(file.path)).toString();
                },
                async json() {
                    // @ts-ignore
                    return JSON.parse((await Deno.readTextFile(file.path)).toString());
                },
                async arrayBuffer() {
                    // @ts-ignore
                    return (await Deno.readTextFile(file.path));
                }
            };
        }
        catch (e) {
            if (e.name === 'CacheError' && e.message.indexOf('Not Found !== -1')) {
                return { status: 404, statusText: e.toString() };
            }
            throw e;
        }
    }
    // @ts-ignore
    return __fetch(url, ...args);
};

function computeIntegrity(source) {
    const hash = createHash('sha384');
    hash.update(source);
    return 'sha384-' + hash.digest('base64');
}

var __classPrivateFieldSet = (undefined && undefined.__classPrivateFieldSet) || function (receiver, privateMap, value) {
    if (!privateMap.has(receiver)) {
        throw new TypeError("attempted to set private field on non-instance");
    }
    privateMap.set(receiver, value);
    return value;
};
var __classPrivateFieldGet = (undefined && undefined.__classPrivateFieldGet) || function (receiver, privateMap) {
    if (!privateMap.has(receiver)) {
        throw new TypeError("attempted to get private field on non-instance");
    }
    return privateMap.get(receiver);
};
var _POOL_SIZE, _opCnt, _cbs;
class Pool {
    constructor(POOL_SIZE) {
        _POOL_SIZE.set(this, 10);
        _opCnt.set(this, 0);
        _cbs.set(this, []);
        __classPrivateFieldSet(this, _POOL_SIZE, POOL_SIZE);
    }
    async queue() {
        if (__classPrivateFieldSet(this, _opCnt, +__classPrivateFieldGet(this, _opCnt) + 1) > __classPrivateFieldGet(this, _POOL_SIZE))
            await new Promise(resolve => __classPrivateFieldGet(this, _cbs).push(resolve));
    }
    pop() {
        __classPrivateFieldSet(this, _opCnt, +__classPrivateFieldGet(this, _opCnt) - 1);
        const cb = __classPrivateFieldGet(this, _cbs).pop();
        if (cb)
            cb();
    }
}
_POOL_SIZE = new WeakMap(), _opCnt = new WeakMap(), _cbs = new WeakMap();

const cdnUrl = 'https://x.nest.land/';
function pkgToUrl(pkg) {
    return cdnUrl + pkg.name + '/' + pkg.version + '/';
}
function parseUrlPkg(url) {
    if (!url.startsWith(cdnUrl))
        return;
    const [name, version] = url.slice(cdnUrl.length).split('/');
    return { registry: 'nest', name, version };
}
async function resolveLatestTarget(target, unstable, parentUrl) {
    if (target.registry !== 'nest')
        return null;
    const res = await fetch('https://x.nest.land/api/package/' + target.name, this.fetchOpts);
    switch (res.status) {
        case 304:
        case 200:
            const egg = await res.json();
            const versions = egg.packageUploadNames.map((name) => name.slice(name.indexOf('@') + 1));
            let bestMatch;
            for (const range of target.ranges) {
                const match = range.bestMatch(versions, unstable);
                if (match && (!bestMatch || match.gt(bestMatch)))
                    bestMatch = match;
            }
            if (!bestMatch)
                return null;
            return { registry: 'nest', name: egg.normalizedName, version: bestMatch.toString() };
        case 404:
            return null;
        default:
            throw new JspmError(`Invalid status code ${res.status} looking up "${target.registry}:${target.name}" - ${res.statusText}${importedFrom(parentUrl)}`);
    }
}

var nest = /*#__PURE__*/Object.freeze({
    __proto__: null,
    cdnUrl: cdnUrl,
    pkgToUrl: pkgToUrl,
    parseUrlPkg: parseUrlPkg,
    resolveLatestTarget: resolveLatestTarget
});

const { SemverRange } = sver;
const supportedProtocols = ['https', 'http', 'data', 'file'];
async function parseUrlTarget(targetStr) {
    var _a;
    const registryIndex = targetStr.indexOf(':');
    if (isRelative(targetStr) || registryIndex !== -1 && supportedProtocols.includes(targetStr.slice(0, registryIndex))) {
        const subpathIndex = targetStr.indexOf('|');
        let subpath;
        if (subpathIndex === -1) {
            subpath = '.';
        }
        else {
            subpath = './' + targetStr.slice(subpathIndex + 1);
            targetStr = targetStr.slice(0, subpathIndex);
        }
        const target = new URL(targetStr + (targetStr.endsWith('/') ? '' : '/'), baseUrl);
        const pkgUrl = await resolver.getPackageBase(target.href);
        const alias = ((_a = (pkgUrl ? await resolver.getPackageConfig(pkgUrl) : null)) === null || _a === void 0 ? void 0 : _a.name) || target.pathname.split('/').pop();
        if (!alias)
            throw new JspmError(`Unable to determine an alias for target package ${target.href}`);
        return { alias, target, subpath };
    }
}
// ad-hoc determination of local path v remote package for eg "jspm deno react" v "jspm deno react@2" v "jspm deno ./react.ts" v "jspm deno react.ts"
const supportedRegistries = ['npm', 'github', 'deno', 'nest'];
function isPackageTarget(targetStr) {
    if (isRelative(targetStr))
        return false;
    const registryIndex = targetStr.indexOf(':');
    if (registryIndex !== -1 && supportedRegistries.includes(targetStr.slice(0, registryIndex)))
        return true;
    const pkg = parsePkg(targetStr);
    if (!pkg)
        return false;
    if (pkg.pkgName.indexOf('@') !== -1)
        return true;
    if (targetStr.endsWith('.ts') || targetStr.endsWith('.js') || targetStr.endsWith('.mjs'))
        return false;
    return true;
}
function pkgUrlToNiceString(pkgUrl) {
    const pkg = resolver.parseUrlPkg(pkgUrl);
    if (pkg) {
        const subpath = pkgUrl.slice(resolver.pkgToUrl(pkg).length);
        return pkgToStr(pkg) + subpath;
    }
    if (pkgUrl.startsWith('file:')) {
        return urlToNiceStr(pkgUrl);
    }
    return pkgUrl;
}
async function toPackageTarget(targetStr, parentPkgUrl) {
    const urlTarget = await parseUrlTarget(targetStr);
    if (urlTarget)
        return urlTarget;
    const registryIndex = targetStr.indexOf(':');
    // TODO: package aliases support as per https://github.com/npm/rfcs/blob/latest/implemented/0001-package-aliases.md
    const versionOrScopeIndex = targetStr.indexOf('@');
    if (targetStr.indexOf(':') !== -1 && versionOrScopeIndex !== -1 && versionOrScopeIndex < registryIndex)
        throw new Error(`Package aliases not yet supported. PRs welcome.`);
    const pkg = parsePkg(targetStr);
    if (!pkg)
        throw new JspmError(`Invalid package name ${targetStr}`);
    let alias = pkg.pkgName;
    const versionIndex = pkg.pkgName.indexOf('@', 1);
    if (versionIndex !== -1)
        alias = pkg.pkgName.slice(registryIndex + 1, versionIndex);
    else
        alias = pkg.pkgName.slice(registryIndex + 1);
    return {
        alias,
        target: newPackageTarget(pkg.pkgName, parentPkgUrl),
        subpath: pkg.subpath
    };
}
function newPackageTarget(target, parentPkgUrl, depName) {
    let registry, name, ranges;
    const registryIndex = target.indexOf(':');
    registry = registryIndex < 1 ? 'npm' : target.substr(0, registryIndex);
    if (registry === 'file')
        return new URL(target.slice(registry.length + 1), parentPkgUrl);
    const versionIndex = target.lastIndexOf('@');
    if (versionIndex > registryIndex + 1) {
        name = target.slice(registryIndex + 1, versionIndex);
        const version = target.slice(versionIndex + 1);
        ranges = (depName || SemverRange.isValid(version)) ? [new SemverRange(version)] : version.split('||').map(v => convertRange(v));
    }
    else if (registryIndex === -1 && depName) {
        name = depName;
        ranges = SemverRange.isValid(target) ? [new SemverRange(target)] : target.split('||').map(v => convertRange(v));
    }
    else {
        name = target.slice(registryIndex + 1);
        ranges = [new SemverRange('*')];
    }
    if (registryIndex === -1 && name.indexOf('/') !== -1 && name[0] !== '@')
        registry = 'github';
    const targetNameLen = name.split('/').length;
    if (targetNameLen > 2 || targetNameLen === 1 && name[0] === '@')
        throw new JspmError(`Invalid package target ${target}`);
    return { registry, name, ranges };
}
function pkgToStr(pkg) {
    return `${pkg.registry ? pkg.registry + ':' : ''}${pkg.name}${pkg.version ? '@' + pkg.version : ''}`;
}
function parsePkg(specifier) {
    let sepIndex = specifier.indexOf('/');
    if (specifier[0] === '@') {
        if (sepIndex === -1)
            return;
        sepIndex = specifier.indexOf('/', sepIndex + 1);
    }
    // TODO: Node.js validations like percent encodng checks
    if (sepIndex === -1)
        return { pkgName: specifier, subpath: '.' };
    return { pkgName: specifier.slice(0, sepIndex), subpath: '.' + specifier.slice(sepIndex) };
}
// export function getPackageName (specifier: string, parentUrl: string) {
//   let sepIndex = specifier.indexOf('/');
//   if (specifier[0] === '@') {
//     if (sepIndex === -1)
//       throw new Error(`${specifier} is not an invalid scope name${importedFrom(parentUrl)}.`);
//     sepIndex = specifier.indexOf('/', sepIndex + 1);
//   }
//   return sepIndex === -1 ? specifier : specifier.slice(0, sepIndex);
// }

const cdnUrl$1 = 'https://ga.jspm.io/';
function pkgToUrl$1(pkg) {
    return cdnUrl$1 + pkgToStr(pkg) + '/';
}
const exactPkgRegEx = /^(([a-z]+):)?((?:@[^/\\%@]+\/)?[^./\\%@][^/\\%@]*)@([^\/]+)(\/.*)?$/;
function parseUrlPkg$1(url) {
    if (!url.startsWith(cdnUrl$1))
        return;
    const [, , registry, name, version] = url.slice(cdnUrl$1.length).match(exactPkgRegEx) || [];
    return { registry, name, version };
}
let resolveCache = {};
function clearResolveCache() {
    resolveCache = {};
}
async function resolveLatestTarget$1(target, unstable, parentUrl) {
    const { registry, name, ranges } = target;
    // exact version optimization
    if (ranges.length === 1 && ranges[0].isExact && !ranges[0].version.tag)
        return { registry, name, version: ranges[0].version.toString() };
    const cache = resolveCache[target.registry + ':' + target.name] = resolveCache[target.registry + ':' + target.name] || {
        latest: null,
        majors: Object.create(null),
        minors: Object.create(null),
        tags: Object.create(null)
    };
    for (const range of ranges.reverse()) {
        if (range.isWildcard) {
            let lookup = await (cache.latest || (cache.latest = lookupRange.call(this, registry, name, '', unstable, parentUrl)));
            // Deno wat?
            if (lookup instanceof Promise)
                lookup = await lookup;
            if (lookup) {
                if (lookup instanceof Promise)
                    throwInternalError();
                log('resolve', `${target.registry}:${target.name}@${target.ranges.map(range => range.toString()).join('|')} -> WILDCARD ${lookup.version}${parentUrl ? ' [' + parentUrl + ']' : ''}`);
                return lookup;
            }
        }
        else if (range.isExact && range.version.tag) {
            const tag = range.version.tag;
            let lookup = await (cache.tags[tag] || (cache.tags[tag] = lookupRange.call(this, registry, name, tag, unstable, parentUrl)));
            // Deno wat?
            if (lookup instanceof Promise)
                lookup = await lookup;
            if (lookup) {
                if (lookup instanceof Promise)
                    throwInternalError();
                log('resolve', `${target.registry}:${target.name}@${target.ranges.map(range => range.toString()).join('|')} -> TAG ${tag}${parentUrl ? ' [' + parentUrl + ']' : ''}`);
                return lookup;
            }
        }
        else if (range.isMajor) {
            const major = range.version.major;
            let lookup = await (cache.majors[major] || (cache.majors[major] = lookupRange.call(this, registry, name, major, unstable, parentUrl)));
            // Deno wat?
            if (lookup instanceof Promise)
                lookup = await lookup;
            if (lookup) {
                if (lookup instanceof Promise)
                    throwInternalError();
                log('resolve', `${target.registry}:${target.name}@${target.ranges.map(range => range.toString()).join('|')} -> MAJOR ${lookup.version}${parentUrl ? ' [' + parentUrl + ']' : ''}`);
                return lookup;
            }
        }
        else if (range.isStable) {
            const minor = `${range.version.major}.${range.version.minor}`;
            let lookup = await (cache.minors[minor] || (cache.minors[minor] = lookupRange.call(this, registry, name, minor, unstable, parentUrl)));
            // Deno wat?
            if (lookup instanceof Promise)
                lookup = await lookup;
            if (lookup) {
                if (lookup instanceof Promise)
                    throwInternalError();
                log('resolve', `${target.registry}:${target.name}@${target.ranges.map(range => range.toString()).join('|')} -> MINOR ${lookup.version}${parentUrl ? ' [' + parentUrl + ']' : ''}`);
                return lookup;
            }
        }
    }
    return null;
}
function pkgToLookupUrl(pkg, edge = false) {
    return `${cdnUrl$1}${pkg.registry}:${pkg.name}${pkg.version ? '@' + pkg.version : edge ? '@' : ''}`;
}
async function lookupRange(registry, name, range, unstable, parentUrl) {
    const res = await _fetch(pkgToLookupUrl({ registry, name, version: range }, unstable), this.fetchOpts);
    switch (res.status) {
        case 304:
        case 200:
            return { registry, name, version: (await res.text()).trim() };
        case 404:
            return null;
        default:
            throw new JspmError(`Invalid status code ${res.status} looking up "${registry}:${name}" - ${res.statusText}${importedFrom(parentUrl)}`);
    }
}

var jspm = /*#__PURE__*/Object.freeze({
    __proto__: null,
    cdnUrl: cdnUrl$1,
    pkgToUrl: pkgToUrl$1,
    parseUrlPkg: parseUrlPkg$1,
    clearResolveCache: clearResolveCache,
    resolveLatestTarget: resolveLatestTarget$1
});

const providers = {
    [cdnUrl]: nest,
    // [deno.cdnUrl]: deno,
    [cdnUrl$1]: jspm
};
const registryProviders = {
    nest: nest,
    // deno: deno,
    npm: jspm
};

class Resolver {
    constructor(fetchOpts) {
        this.pcfgPromises = Object.create(null);
        this.pcfgs = Object.create(null);
        this.fetchOpts = fetchOpts;
    }
    parseUrlPkg(url) {
        for (const cdnUrl of Object.keys(providers)) {
            if (url.startsWith(cdnUrl))
                return providers[cdnUrl].parseUrlPkg.call(this, url);
        }
    }
    pkgToUrl(pkg) {
        return registryProviders[pkg.registry].pkgToUrl.call(this, pkg);
    }
    async getPackageBase(url) {
        const pkg = this.parseUrlPkg(url);
        if (pkg)
            return this.pkgToUrl(pkg);
        if (url.startsWith('node:'))
            return url;
        let testUrl = new URL('./', url);
        do {
            let responseUrl;
            if (responseUrl = await resolver.checkPjson(testUrl.href))
                return new URL('.', responseUrl).href;
            // if hitting the base and we are in the cwd, use the cwd
            if (testUrl.pathname === '/') {
                const cwd = pathToFileURL(process.cwd()) + '/';
                if (url.startsWith(cwd))
                    return cwd;
                return testUrl.href;
            }
        } while (testUrl = new URL('../', testUrl));
    }
    async getPackageConfig(pkgUrl) {
        if (!pkgUrl.endsWith('/'))
            throw new Error(`Internal Error: Package URL must end in "/". Got ${pkgUrl}`);
        let cached = this.pcfgs[pkgUrl];
        if (cached)
            return cached;
        if (!this.pcfgPromises[pkgUrl])
            this.pcfgPromises[pkgUrl] = (async () => {
                var _a, _b;
                for (const cdnUrl of Object.keys(providers)) {
                    if (pkgUrl.startsWith(cdnUrl)) {
                        const pcfg = await ((_a = providers[cdnUrl].getPackageConfig) === null || _a === void 0 ? void 0 : _a.call(this, pkgUrl));
                        if (pcfg !== undefined) {
                            this.pcfgs[pkgUrl] = pcfg;
                            return;
                        }
                        break;
                    }
                }
                const res = await _fetch(`${pkgUrl}package.json`, this.fetchOpts);
                switch (res.status) {
                    case 200:
                    case 304:
                        break;
                    case 404:
                    case 406:
                        this.pcfgs[pkgUrl] = null;
                        return;
                    default:
                        throw new JspmError(`Invalid status code ${res.status} reading package config for ${pkgUrl}. ${res.statusText}`);
                }
                if (res.headers && !((_b = res.headers.get('Content-Type')) === null || _b === void 0 ? void 0 : _b.match(/^application\/json(;|$)/))) {
                    this.pcfgs[pkgUrl] = null;
                }
                else
                    try {
                        this.pcfgs[pkgUrl] = await res.json();
                    }
                    catch (e) {
                        this.pcfgs[pkgUrl] = null;
                    }
            })();
        await this.pcfgPromises[pkgUrl];
        return this.pcfgs[pkgUrl];
    }
    async getDepList(pkgUrl, dev = false) {
        const pjson = (await this.getPackageConfig(pkgUrl));
        if (!pjson)
            return [];
        return [...new Set([
                Object.keys(pjson.dependencies || {}),
                Object.keys(dev && pjson.devDependencies || {}),
                Object.keys(pjson.peerDependencies || {}),
                Object.keys(pjson.optionalDependencies || {})
            ].flat())];
    }
    async checkPjson(url) {
        if (await this.getPackageConfig(url) === null)
            return false;
        return url;
    }
    async exists(resolvedUrl) {
        const res = await _fetch(resolvedUrl, this.fetchOpts);
        switch (res.status) {
            case 200:
            case 304:
                return true;
            case 404:
            case 406:
                return false;
            default: throw new JspmError(`Invalid status code ${res.status} loading ${resolvedUrl}. ${res.statusText}`);
        }
    }
    async resolveLatestTarget(target, unstable, parentUrl) {
        const provider = registryProviders[target.registry];
        if (!provider)
            throw new JspmError(`No registry provider configured for ${target.registry}.`);
        const pkg = await provider.resolveLatestTarget.call(this, target, unstable, parentUrl);
        if (pkg)
            return pkg;
        throw new JspmError(`Unable to resolve package ${target.registry}:${target.name} to "${target.ranges.join(' || ')}"${importedFrom(parentUrl)}`);
    }
    async wasCommonJS(url) {
        var _a;
        const pkgUrl = await this.getPackageBase(url);
        if (!pkgUrl)
            return false;
        const pcfg = await this.getPackageConfig(pkgUrl);
        if (!pcfg)
            return false;
        const subpath = './' + url.slice(pkgUrl.length);
        return ((_a = pcfg === null || pcfg === void 0 ? void 0 : pcfg.exports) === null || _a === void 0 ? void 0 : _a[subpath + '!cjs']) ? true : false;
    }
    async resolveExports(pkgUrl, env, subpathFilter) {
        const pcfg = await this.getPackageConfig(pkgUrl) || {};
        // conditional resolution from conditions
        // does in-browser package resolution
        // index.js | index.json
        // main[.js|.json|.node|'']
        // 
        // Because of extension checks on CDN, we do .js|.json|.node FIRST (if not already one of those extensions)
        // all works out
        // exports are exact files
        // done
        const exports = Object.create(null);
        if (pcfg.exports !== undefined && pcfg.exports !== null) {
            function allDotKeys(exports) {
                for (let p in exports) {
                    if (p[0] !== '.')
                        return false;
                }
                return true;
            }
            if (typeof pcfg.exports === 'string') {
                exports['.'] = pcfg.exports;
            }
            else if (!allDotKeys(pcfg.exports)) {
                exports['.'] = getExportsTarget(pcfg.exports, env);
            }
            else {
                for (const expt of Object.keys(pcfg.exports)) {
                    exports[expt] = getExportsTarget(pcfg.exports[expt], env);
                }
            }
        }
        else {
            if (typeof pcfg.browser === 'string') {
                exports['.'] = pcfg.browser.startsWith('./') ? pcfg.browser : './' + pcfg.browser;
            }
            else if (typeof pcfg.main === 'string') {
                exports['.'] = pcfg.main.startsWith('./') ? pcfg.main : './' + pcfg.main;
            }
            if (typeof pcfg.browser === 'object') {
                for (const subpath of Object.keys(pcfg.browser)) {
                    if (subpath.startsWith('./')) {
                        if (exports['.'] === subpath)
                            exports['.'] = pcfg.browser[subpath];
                        exports[subpath] = pcfg.browser[subpath];
                    }
                    else {
                        log('todo', `Non ./ subpaths in browser field: ${pcfg.name}.browser['${subpath}'] = ${pcfg.browser[subpath]}`);
                    }
                }
            }
            if (!exports['./'])
                exports['./'] = './';
            if (!exports['.'])
                exports['.'] = '.';
        }
        if (subpathFilter) {
            subpathFilter = './' + subpathFilter;
            const filteredExports = Object.create(null);
            for (const key of Object.keys(exports)) {
                if (key.startsWith(subpathFilter) && (key.length === subpathFilter.length || key[subpathFilter.length] === '/')) {
                    filteredExports['.' + key.slice(subpathFilter.length)] = exports[key];
                }
                else if (key.endsWith('*')) {
                    const patternBase = key.slice(0, -1);
                    if (subpathFilter.startsWith(patternBase)) {
                        const replacement = subpathFilter.slice(patternBase.length);
                        filteredExports['.'] = replaceTargets(exports[key], replacement);
                        filteredExports['./*'] = replaceTargets(exports[key], replacement + '/*');
                    }
                }
            }
            function replaceTargets(target, replacement) {
                if (Array.isArray(target)) {
                    return [...target.map(target => replaceTargets(target, replacement))];
                }
                else if (typeof target === 'object' && target !== null) {
                    const newTarget = {};
                    for (const key of Object.keys(target))
                        newTarget[key] = replaceTargets(target[key], replacement);
                    return newTarget;
                }
                else if (typeof target === 'string') {
                    return target.replace(/\*/g, replacement);
                }
                return target;
            }
            return filteredExports;
        }
        return exports;
    }
    async getIntegrity(url) {
        const res = await _fetch(url, this.fetchOpts);
        switch (res.status) {
            case 200:
            case 304: break;
            case 404: throw new Error(`URL ${url} not found.`);
            default: throw new Error(`Invalid status code ${res.status} requesting ${url}. ${res.statusText}`);
        }
        return computeIntegrity(await res.text());
    }
    async dlPackage(pkgUrl, outDirPath, beautify = false) {
        if (existsSync(outDirPath))
            throw new JspmError(`Checkout directory ${outDirPath} already exists.`);
        if (!pkgUrl.endsWith('/'))
            pkgUrl += '/';
        const dlPool = new Pool(20);
        const pkgContents = Object.create(null);
        const pcfg = await resolver.getPackageConfig(pkgUrl);
        if (!pcfg || !pcfg.files || !(pcfg.files instanceof Array))
            throw new JspmError(`Unable to checkout ${pkgUrl} as there is no package files manifest.`);
        await Promise.all((pcfg.files).map(async (file) => {
            const url = pkgUrl + file;
            await dlPool.queue();
            try {
                const res = await _fetch(url, this.fetchOpts);
                switch (res.status) {
                    case 304:
                    case 200:
                        const contentType = res.headers && res.headers.get('content-type');
                        let contents = await res.arrayBuffer();
                        if (beautify) {
                            if (contentType === 'application/javascript') {
                                // contents = jsBeautify(contents);
                            }
                            else if (contentType === 'application/json') {
                                contents = JSON.stringify(JSON.parse(contents.toString()), null, 2);
                            }
                        }
                        return pkgContents[file] = contents;
                    default: throw new JspmError(`Invalid status code ${res.status} looking up ${url} - ${res.statusText}`);
                }
            }
            finally {
                dlPool.pop();
            }
        }));
        for (const file of Object.keys(pkgContents)) {
            const filePath = outDirPath + '/' + file;
            mkdirp.sync(path.dirname(filePath));
            writeFileSync(filePath, Buffer.from(pkgContents[file]));
        }
    }
    async parseTs(source) {
        // @ts-ignore
        const ts = await import('typescript');
        return ts.transpileModule(source, {
            compilerOptions: {
                jsx: 'react',
                module: ts.ModuleKind.ESNext
            }
        }).outputText;
    }
    async analyze(resolvedUrl, parentUrl, system = false) {
        const res = await _fetch(resolvedUrl, this.fetchOpts);
        switch (res.status) {
            case 200:
            case 304:
                break;
            case 404: throw new JspmError(`Module not found: ${resolvedUrl}${importedFrom(parentUrl)}`);
            default: throw new JspmError(`Invalid status code ${res.status} loading ${resolvedUrl}. ${res.statusText}`);
        }
        let source = await res.text();
        try {
            if (resolvedUrl.endsWith('.ts') || resolvedUrl.endsWith('.tsx') || resolvedUrl.endsWith('.jsx'))
                source = await this.parseTs(source);
            const [imports] = await parse(source);
            return system ? createSystemAnalysis(source, imports, resolvedUrl) : createEsmAnalysis(imports, source, resolvedUrl);
        }
        catch (e) {
            if (!e.message || !e.message.startsWith('Parse error @:'))
                throw e;
            // fetch is _unstable_!!!
            // so we retry the fetch first
            const res = await _fetch(resolvedUrl, this.fetchOpts);
            switch (res.status) {
                case 200:
                case 304:
                    break;
                case 404: throw new JspmError(`Module not found: ${resolvedUrl}${importedFrom(parentUrl)}`);
                default: throw new JspmError(`Invalid status code ${res.status} loading ${resolvedUrl}. ${res.statusText}`);
            }
            source = await res.text();
            try {
                const [imports] = await parse(source);
                return system ? createSystemAnalysis(source, imports, resolvedUrl) : createEsmAnalysis(imports, source, resolvedUrl);
            }
            catch (e) {
                // TODO: better parser errors
                if (e.message && e.message.startsWith('Parse error @:')) {
                    const pos = e.message.slice(14, e.message.indexOf('\n'));
                    let [line, col] = pos.split(':');
                    const lines = source.split('\n');
                    // console.log(source);
                    if (line > 1)
                        console.log('  ' + lines[line - 2]);
                    console.log('> ' + lines[line - 1]);
                    console.log('  ' + ' '.repeat(col - 1) + '^');
                    if (lines.length > 1)
                        console.log('  ' + lines[line]);
                    throw new JspmError(`Error parsing ${resolvedUrl}:${pos}`);
                }
                throw e;
            }
        }
    }
}
function getExportsTarget(target, env) {
    if (typeof target === 'string') {
        return target;
    }
    else if (typeof target === 'object' && target !== null && !Array.isArray(target)) {
        for (const condition in target) {
            if (condition === 'default' || env.includes(condition)) {
                const resolved = getExportsTarget(target[condition], env);
                if (resolved)
                    return resolved;
            }
        }
    }
    else if (Array.isArray(target)) {
        // TODO: Validation for arrays
        for (const targetFallback of target) {
            return getExportsTarget(targetFallback, env);
        }
    }
    return null;
}
function createEsmAnalysis(imports, source, url) {
    if (!imports.length && registerRegEx.test(source))
        return createSystemAnalysis(source, imports);
    const deps = [];
    const dynamicDeps = [];
    for (const impt of imports) {
        if (impt.d === -1) {
            deps.push(source.slice(impt.s, impt.e));
            continue;
        }
        // dynamic import -> deoptimize trace all dependencies (and all their exports)
        if (impt.d >= 0) {
            const dynExpression = source.slice(impt.s, impt.e);
            if (dynExpression.startsWith('"') || dynExpression.startsWith('\'')) {
                try {
                    dynamicDeps.push(JSON.parse('"' + dynExpression.slice(1, -1) + '"'));
                }
                catch (e) {
                    console.warn('TODO: Dynamic import custom expression tracing.');
                }
            }
        }
    }
    const size = source.length;
    return { deps, dynamicDeps, size, integrity: computeIntegrity(source), system: false };
}
const registerRegEx = /^\s*(\/\*[^\*]*(\*(?!\/)[^\*]*)*\*\/|\s*\/\/[^\n]*)*\s*System\s*\.\s*register\s*\(\s*(\[[^\]]*\])\s*,\s*\(?function\s*\(\s*([^\),\s]+\s*(,\s*([^\),\s]+)\s*)?\s*)?\)/;
function createSystemAnalysis(source, imports, url) {
    const [, , , rawDeps, , , contextId] = source.match(registerRegEx) || [];
    if (!rawDeps)
        return createEsmAnalysis(imports, source);
    const deps = JSON.parse(rawDeps.replace(/'/g, '"'));
    const dynamicDeps = [];
    if (contextId) {
        const dynamicImport = `${contextId}.import(`;
        let i = -1;
        while ((i = source.indexOf(dynamicImport, i + 1)) !== -1) {
            const importStart = i + dynamicImport.length + 1;
            const quote = source[i + dynamicImport.length];
            if (quote === '"' || quote === '\'') {
                const importEnd = source.indexOf(quote, i + dynamicImport.length + 1);
                if (importEnd !== -1) {
                    try {
                        dynamicDeps.push(JSON.parse('"' + source.slice(importStart, importEnd) + '"'));
                        continue;
                    }
                    catch (e) { }
                }
            }
            console.warn('TODO: Dynamic import custom expression tracing.');
        }
    }
    const size = source.length;
    return { deps, dynamicDeps, size, integrity: computeIntegrity(source), system: true };
}
let resolver = new Resolver();
function newResolver(fetchOpts) {
    resolver = new Resolver(fetchOpts);
}
function setOffline(isOffline = true) {
    if (isOffline)
        newResolver({ cache: 'only-if-cached' });
    else
        newResolver();
}

export { JspmError as J, Resolver as R, resolver as a, importedFrom as b, baseUrl as c, isPlain as d, parseUrlTarget as e, isPackageTarget as f, pkgUrlToNiceString as g, toPackageTarget as h, isURL as i, pkgToStr as j, getExportsTarget as k, log as l, newResolver as m, newPackageTarget as n, parsePkg as p, relativeUrl as r, setOffline as s, throwInternalError as t };
