interface Log {
    type: string;
    message: string;
}
export declare const logStream: () => AsyncGenerator<Log, never, unknown>;
export declare function log(type: string, message: string): void;
export {};
