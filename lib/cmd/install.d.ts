import { TraceMapOptions } from '../tracemap/tracemap.js';
export declare function install(targets: string | string[], opts: TraceMapOptions): Promise<{
    changed: boolean;
    installed: string[];
}>;
