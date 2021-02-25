let resolveQueue;
let queuePromise = new Promise(resolve => resolveQueue = resolve);
let queue = [];
export const logStream = async function* () {
    while (true) {
        while (queue.length)
            yield queue.shift();
        await queuePromise;
    }
};
export function log(type, message) {
    if (queue.length) {
        queue.push({ type, message });
    }
    else {
        queue = [{ type, message }];
        const _resolveQueue = resolveQueue;
        queuePromise = new Promise(resolve => resolveQueue = resolve);
        _resolveQueue();
    }
}
//# sourceMappingURL=log.js.map