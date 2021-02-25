import { PackageTarget } from "../install/package.js";
import { ExactPackage } from "../install/package.js";
import { Resolver } from "../install/resolver.js";
export declare const cdnUrl = "https://ga.jspm.io/";
export declare function pkgToUrl(pkg: ExactPackage): string;
export declare function parseUrlPkg(url: string): ExactPackage | undefined;
export declare function clearResolveCache(): void;
export declare function resolveLatestTarget(this: Resolver, target: PackageTarget, unstable: boolean, parentUrl?: string): Promise<ExactPackage | null>;
