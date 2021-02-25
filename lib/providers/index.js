import * as nest from './nest.land.js';
// import * as deno from './deno.land.ts';
import * as jspm from './jspm.io.js';
export const providers = {
    [nest.cdnUrl]: nest,
    // [deno.cdnUrl]: deno,
    [jspm.cdnUrl]: jspm
};
export const registryProviders = {
    nest: nest,
    // deno: deno,
    npm: jspm
};
//# sourceMappingURL=index.js.map