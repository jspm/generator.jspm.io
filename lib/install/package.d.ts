import { InstallTarget } from "./installer.js";
export interface ExactPackage {
    registry: string;
    name: string;
    version: string;
}
export declare type ExportsTarget = string | null | {
    [condition: string]: ExportsTarget;
} | ExportsTarget[];
export interface PackageConfig {
    registry?: string;
    name?: string;
    version?: string;
    main?: string;
    files?: string[];
    browser?: string | Record<string, string>;
    exports?: ExportsTarget | Record<string, ExportsTarget>;
    type?: string;
    dependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
    optionalDependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
}
export interface PackageTarget {
    registry: string;
    name: string;
    ranges: any[];
}
export declare function parseUrlTarget(targetStr: string): Promise<{
    alias: string;
    target: URL;
    subpath: string;
} | undefined>;
export declare function isPackageTarget(targetStr: string): boolean;
export declare function pkgUrlToNiceString(pkgUrl: string): any;
export declare function toPackageTarget(targetStr: string, parentPkgUrl: string): Promise<{
    alias: string;
    target: InstallTarget;
    subpath: string;
}>;
export declare function newPackageTarget(target: string, parentPkgUrl: string, depName?: string): InstallTarget;
export declare function pkgToStr(pkg: ExactPackage): string;
export declare function parsePkg(specifier: string): {
    pkgName: string;
    subpath: string;
} | undefined;
