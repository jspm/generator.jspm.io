export interface IImportMap {
    baseUrl?: URL;
    imports?: Record<string, string | null>;
    scopes?: {
        [scope: string]: Record<string, string | null>;
    };
    integrity?: {
        [url: string]: string;
    };
    depcache?: {
        [url: string]: string[];
    };
}
export declare class ImportMap implements IImportMap {
    imports: Record<string, string | null>;
    scopes: Record<string, Record<string, string | null>>;
    integrity: Record<string, string>;
    depcache: Record<string, string[]>;
    baseUrl: URL;
    private mapStyle;
    constructor(mapBaseUrl?: URL);
    clone(): ImportMap;
    extend(map: IImportMap, overrideScopes?: boolean): this;
    sort(): void;
    clearIntegrity(): void;
    clearDepcache(): void;
    setIntegrity(url: string, integrity: string): void;
    addMapping(name: string, targetUrl: string, parent?: string | null): void;
    replace(pkgUrl: string, newPkgUrl: URL): this;
    combineSubpaths(): void;
    flatten(): this;
    rebase(newBaseUrl?: string): this;
    resolve(specifier: string, parentUrl: URL): URL | null;
    toJSON(): any;
    toString(minify?: boolean): string;
}
export declare function getScopeMatches(parentUrl: URL, scopes: Record<string, Record<string, string | null>>, baseUrl: URL): [string, string][];
export declare function getMapMatch<T = any>(specifier: string, map: Record<string, T>): string | undefined;
export declare function getMapResolved(exportMatch: string, exportTarget: string | null, subpathTarget: string): string | null;
