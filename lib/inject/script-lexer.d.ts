export interface ParsedTag {
    name: string;
    start: number;
    end: number;
    attributes: ParsedAttribute[];
    innerStart: number;
    innerEnd: number;
}
export interface ParsedAttribute {
    name: string;
    value: string;
    nameStart: number;
    nameEnd: number;
    valueStart: number;
    valueEnd: number;
}
export declare function parseTags(_source: string, include?: Set<string>): ParsedTag[];
