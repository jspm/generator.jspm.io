import { InstallOptions, InstallTarget } from "../install/installer.js";
import { Installer } from "../install/installer.js";
import { IImportMap, ImportMap } from "./map.js";
import { Script } from "../inject/map";
export interface TraceMapOptions extends InstallOptions {
    system?: boolean;
    env?: string[];
    inputMap?: IImportMap;
    static?: boolean;
    fullMap?: boolean;
}
interface TraceGraph {
    [tracedUrls: string]: TraceEntry;
}
interface TraceEntry {
    deps: Record<string, string>;
    dynamicDeps: Record<string, string[]>;
    hasStaticParent: boolean;
    size: number;
    integrity: string;
    system: boolean;
    babel: boolean;
}
export default class TraceMap {
    env: string[];
    installer: Installer | undefined;
    opts: TraceMapOptions;
    tracedUrls: TraceGraph;
    map: ImportMap;
    mapBase: URL;
    pjsonBase: URL | undefined;
    traces: Set<string>;
    staticList: Set<string>;
    dynamicList: Set<string>;
    constructor(mapBase: URL, opts?: TraceMapOptions);
    replace(target: InstallTarget, pkgUrl: string): boolean;
    visit(url: string, visitor: (url: string, entry: TraceEntry) => Promise<boolean | void>, seen?: Set<unknown>): Promise<void>;
    getPreloads(integrity: boolean, baseUrl: URL): Script[];
    checkTypes(): {
        system: boolean;
        esm: boolean;
    };
    startInstall(): Promise<(success: boolean) => Promise<boolean>>;
    add(name: string, target: InstallTarget, persist?: boolean): Promise<string>;
    addAllPkgMappings(name: string, pkgUrl: string, env: string[], parentPkgUrl: string | null): Promise<void>;
    trace(specifier: string, parentUrl?: URL, env?: string[]): Promise<string>;
    private traceUrl;
}
export {};
