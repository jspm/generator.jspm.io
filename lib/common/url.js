// @ts-ignore
import { pathToFileURL, fileURLToPath } from 'url';
// @ts-ignore
import process from 'process';
import path from 'path';
export let baseUrl;
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
export function importedFrom(parentUrl) {
    if (!parentUrl)
        return '';
    return ` imported from ${parentUrl}`;
}
export function relativeUrl(url, baseUrl) {
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
export function isURL(specifier) {
    try {
        new URL(specifier);
    }
    catch {
        return false;
    }
    return true;
}
export function isPlain(specifier) {
    return !isRelative(specifier) && !isURL(specifier);
}
export function isRelative(specifier) {
    return specifier.startsWith('./') || specifier.startsWith('../') || specifier.startsWith('/');
}
export function urlToNiceStr(url) {
    let relPath = path.relative(process.cwd(), fileURLToPath(url));
    if (relPath[0] !== '.')
        relPath = './' + relPath;
    return relPath;
}
//# sourceMappingURL=url.js.map