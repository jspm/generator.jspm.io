import { ExportsTarget } from '../install/package.js';
export declare function list(module: string): Promise<{
    resolved: string;
    exports: Record<string, ExportsTarget>;
}>;
