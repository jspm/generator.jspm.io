export interface Lockfile {
    exists: boolean;
    resolutions: LockResolutions;
}
export interface LockResolutions {
    [pkgUrl: string]: Record<string, string>;
}
export declare function getResolution(resolutions: LockResolutions, name: string, pkgUrl: string): string | undefined;
export declare function setResolution(resolutions: LockResolutions, name: string, pkgUrl: string, resolution: string): void;
export declare function pruneResolutions(resolutions: LockResolutions, to: [string, string][]): LockResolutions;
export declare function loadVersionLock(lockFile: string): Lockfile;
export declare function saveVersionLock(resolutions: LockResolutions, lockFile: string): boolean;
