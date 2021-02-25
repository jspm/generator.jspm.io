export class JspmError extends Error {
    constructor(msg, code) {
        super(msg);
        this.jspmError = true;
        this.code = code;
    }
}
export function throwInternalError() {
    throw new Error('Internal Error');
}
//# sourceMappingURL=err.js.map