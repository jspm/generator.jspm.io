import { TraceMapOptions } from '../tracemap/tracemap.js';
export interface MapOptions extends TraceMapOptions {
    out?: string;
    minify?: boolean;
    integrity?: boolean;
    preload?: boolean;
}
export declare function map(modules: string | string[], opts: MapOptions): Promise<{
    changed: boolean;
    output: string;
}>;
