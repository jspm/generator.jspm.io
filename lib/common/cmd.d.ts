declare global {
    var require: any;
}
export declare function runCmd(script: string, projectPath?: string, cwd?: string): Promise<number>;
