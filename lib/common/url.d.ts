declare global {
    var document: any;
    var location: any;
}
export declare let baseUrl: URL;
export declare function importedFrom(parentUrl?: string | URL): string;
export declare function relativeUrl(url: URL, baseUrl: URL): string;
export declare function isURL(specifier: string): boolean;
export declare function isPlain(specifier: string): boolean;
export declare function isRelative(specifier: string): boolean;
export declare function urlToNiceStr(url: URL | string): any;
