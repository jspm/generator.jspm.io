declare global {
    var process: any;
}
declare let _fetch: typeof fetch;
declare let clearCache: () => void;
export { _fetch as fetch, clearCache };
