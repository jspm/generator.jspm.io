var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, privateMap, value) {
    if (!privateMap.has(receiver)) {
        throw new TypeError("attempted to set private field on non-instance");
    }
    privateMap.set(receiver, value);
    return value;
};
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, privateMap) {
    if (!privateMap.has(receiver)) {
        throw new TypeError("attempted to get private field on non-instance");
    }
    return privateMap.get(receiver);
};
var _POOL_SIZE, _opCnt, _cbs;
export class Pool {
    constructor(POOL_SIZE) {
        _POOL_SIZE.set(this, 10);
        _opCnt.set(this, 0);
        _cbs.set(this, []);
        __classPrivateFieldSet(this, _POOL_SIZE, POOL_SIZE);
    }
    async queue() {
        if (__classPrivateFieldSet(this, _opCnt, +__classPrivateFieldGet(this, _opCnt) + 1) > __classPrivateFieldGet(this, _POOL_SIZE))
            await new Promise(resolve => __classPrivateFieldGet(this, _cbs).push(resolve));
    }
    pop() {
        __classPrivateFieldSet(this, _opCnt, +__classPrivateFieldGet(this, _opCnt) - 1);
        const cb = __classPrivateFieldGet(this, _cbs).pop();
        if (cb)
            cb();
    }
}
_POOL_SIZE = new WeakMap(), _opCnt = new WeakMap(), _cbs = new WeakMap();
//# sourceMappingURL=pool.js.map