import '../deps.d.ts';
import MagicString from 'magic-string';
import { ParsedTag } from './script-lexer.js';
export declare function removeElement(source: MagicString, el: {
    start: number;
    end: number;
}): void;
export declare function insertAfter(source: MagicString, el: {
    start: number;
    end: number;
}, injection: string): void;
export declare function insertBefore(source: MagicString, el: {
    start: number;
    end: number;
}, injection: string): void;
export declare function append(source: MagicString, el: {
    start: number;
    end: number;
    innerStart: number;
    innerEnd: number;
}, injection: string): void;
export declare function setInnerWithIndentation(source: MagicString, el: {
    start: number;
    end: number;
    innerStart: number;
    innerEnd: number;
}, injection: string | any): void;
export declare function getOrCreateTag(source: MagicString, els: ParsedTag[], detect: (el: ParsedTag) => boolean, injection: string | null): {
    source: MagicString;
    els: ParsedTag[];
    el: ParsedTag;
};
