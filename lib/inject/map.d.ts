export interface Script {
    url: string;
    integrity?: string;
    crossorigin?: string;
    jspm?: boolean;
}
export interface Injection {
    system?: Script | null;
    systemBabel?: Script | null;
    importMap?: any;
    loads?: Script[] | null;
    preloads?: Script[] | null;
}
export declare function inject(html: string, injection: Injection): string;
