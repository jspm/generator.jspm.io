import { PackageConfig, ExactPackage } from '../install/package.js';
import { Resolver } from '../install/resolver.js';
import { PackageTarget } from '../install/package.js';
interface Provider {
    cdnUrl: string;
    parseUrlPkg(this: Resolver, url: string): ExactPackage | undefined;
    pkgToUrl(this: Resolver, pkg: ExactPackage): string;
    getPackageConfig?(this: Resolver, pkgUrl: string): Promise<PackageConfig | null | undefined>;
    resolveLatestTarget(this: Resolver, target: PackageTarget, unstable: boolean, parentUrl?: string): Promise<ExactPackage | null>;
    getFileList?(this: Resolver, pkgUrl: string): Promise<string[]>;
}
export declare const providers: Record<string, Provider>;
export declare const registryProviders: Record<string, Provider>;
export {};
