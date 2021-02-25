export interface SourceStyle {
    tab: string;
    newline: string;
    trailingNewline: string;
    indent: string;
    quote: string;
}
export declare const defaultStyle: {
    tab: string;
    newline: any;
    trailingNewline: any;
    indent: string;
    quote: string;
};
export declare function detectNewline(source: string): any;
export declare function detectIndent(source: string, newline: string): {
    indent: string;
    tab: string;
};
export declare function detectStyle(source: string): SourceStyle;
