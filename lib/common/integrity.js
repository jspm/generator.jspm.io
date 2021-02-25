import * as crypto from 'crypto';
export function computeIntegrity(source) {
    const hash = crypto.createHash('sha384');
    hash.update(source);
    return 'sha384-' + hash.digest('base64');
}
//# sourceMappingURL=integrity.js.map