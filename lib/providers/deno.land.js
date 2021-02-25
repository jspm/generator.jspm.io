export const cdnUrl = 'https://x.nest.land/';
export function getPackageBase(url) {
    return cdnUrl + url.slice(cdnUrl.length).split('/').shift() + '/';
}
//# sourceMappingURL=deno.land.js.map