import * as lock from "./lock.js";
import { ExactPackage, PackageTarget } from "./package.js";
export declare const builtinSet: Set<string>;
export interface PackageInstall {
    name: string;
    pkgUrl: string;
}
export interface PackageInstallRange {
    pkg: ExactPackage;
    target: PackageTarget;
    install: PackageInstall;
}
export declare type InstallTarget = PackageTarget | URL;
export interface InstallOptions {
    lock?: boolean;
    freeze?: boolean;
    latest?: boolean;
    reset?: boolean;
    stdlib?: string;
    prune?: boolean;
    save?: boolean;
    saveDev?: boolean;
    savePeer?: boolean;
    saveOptional?: boolean;
}
export declare class Installer {
    opts: InstallOptions;
    installs: lock.LockResolutions;
    installing: boolean;
    newInstalls: boolean;
    currentInstall: Promise<void>;
    stdlibTarget: InstallTarget;
    installBaseUrl: string;
    lockfilePath: string;
    added: Map<string, InstallTarget>;
    hasLock: boolean;
    constructor(baseUrl: URL, opts: InstallOptions);
    startInstall(): Promise<(success: boolean) => Promise<boolean>>;
    lockInstall(installs: string[], pkgUrl?: string, prune?: boolean): Promise<void>;
    replace(target: InstallTarget, replacePkgUrl: string): boolean;
    installTarget(pkgName: string, target: InstallTarget, pkgScope: string, pjsonPersist: boolean, parentUrl?: string): Promise<string>;
    install(pkgName: string, pkgUrl: string, parentUrl?: string): Promise<string>;
    private getInstalledPackages;
    private getBestMatch;
    private inRange;
    private tryUpgradePackagesTo;
}
