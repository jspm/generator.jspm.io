import { ExactPackage, PackageConfig, PackageTarget, ExportsTarget } from './package.js';
export declare class Resolver {
    pcfgPromises: Record<string, Promise<void>>;
    pcfgs: Record<string, PackageConfig | null>;
    fetchOpts: any;
    constructor(fetchOpts?: any);
    parseUrlPkg(url: string): ExactPackage | undefined;
    pkgToUrl(pkg: ExactPackage): string;
    getPackageBase(url: string): Promise<string | undefined>;
    getPackageConfig(pkgUrl: string): Promise<PackageConfig | null>;
    getDepList(pkgUrl: string, dev?: boolean): Promise<string[]>;
    checkPjson(url: string): Promise<string | false>;
    exists(resolvedUrl: string): Promise<boolean>;
    resolveLatestTarget(target: PackageTarget, unstable: boolean, parentUrl?: string): Promise<ExactPackage>;
    resolveExports(pkgUrl: string, env: string[], subpathFilter?: string): Promise<Record<string, string>>;
    getIntegrity(url: string): Promise<string>;
    dlPackage(pkgUrl: string, outDirPath: string, beautify?: boolean): Promise<void>;
    private parseTs;
    analyze(resolvedUrl: string, parentUrl?: URL, system?: boolean): Promise<Analysis>;
}
export declare function getExportsTarget(target: ExportsTarget, env: string[]): string | null;
interface Analysis {
    deps: string[];
    dynamicDeps: string[];
    size: number;
    integrity: string;
    system?: boolean;
}
declare let resolver: Resolver;
export declare function newResolver(fetchOpts?: any): void;
export declare function setOffline(isOffline?: boolean): void;
export { resolver as default };
