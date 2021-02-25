export declare function toCamelCase(name: string): string;
export declare function fromCamelCase(name: string): string;
export declare function readFlags(rawArgs: string[], { boolFlags, strFlags, arrFlags, aliases }?: {
    boolFlags?: string[];
    strFlags?: string[];
    arrFlags?: string[];
    aliases?: Record<string, string>;
}): {
    args: string[];
    opts: Record<string, string | boolean | string[]>;
};
