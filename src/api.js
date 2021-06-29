import { toast } from './toast.js';

let crypto, Semver, Generator, lookup, getPackageConfig;
const initPromise = (async () => {
  [
    { Semver },
    { Generator, lookup, getPackageConfig },
    { default: crypto },
  ] = await Promise.all([
    import('sver'),
    import('@jspm/generator'),
    import('@jspm/core/nodelibs/crypto')
  ]);
})();

const integrityCache = new Map();
export async function getIntegrity (url) {
  if (integrityCache.has(url))
    return integrityCache.get(url);
  const res = await fetch(url);
  const buf = await res.text();
  const hash = crypto.createHash('sha384');
  hash.update(buf);
  const integrity = 'sha384-' + hash.digest('base64');
  integrityCache.set(url, integrity);
  return integrity;
}

// TODO: version lookups
export async function getESModuleShimsScript (integrity) {
  // = resolvePkg + integrity()
  const url = 'https://ga.jspm.io/npm:es-module-shims@0.12.1/dist/es-module-shims.min.js';
  return [{
    async: true,
    url,
    integrity: integrity ? await getIntegrity(url) : '',
    comment: 'ES Module Shims: Import maps polyfill for modules browsers without import maps support (all except Chrome 89+)'
  }];
}

export async function getSystemScripts (integrity) {
  // = resolvePkg + integrity()
  const systemUrl = 'https://ga.system.jspm.io/npm:systemjs@6.10.1/dist/s.min.js';
  const systemBabelUrl = 'https://ga.system.jspm.io/npm:systemjs-babel@0.3.1/dist/systemjs-babel.js';
  return [
    {
      comment: 'SystemJS: Supports loading modules performantly in all browsers back to IE11 (depending on library support)',
      url: systemUrl,
      integrity: integrity ? await getIntegrity(systemUrl) : ''
    },
    {
      hidden: true,
      comment: 'Uncomment SystemJS Babel below for an in-browser ES Module / TypeScript / JSX dev workflow.',
      url: systemBabelUrl,
      integrity: integrity ? await getIntegrity(systemBabelUrl) : ''
    }
  ];
}

export async function getMap (deps, integrity, doPreload, env) {
  await initPromise;
  const generator = new Generator({
    env: Object.keys(env).filter(key => env[key])
  });

  // the static graph always takes preload priority
  const staticPreloads = new Set();
  const dynPreloads = new Set();
  
  for (const [dep, preload] of deps) {
    const { staticDeps, dynamicDeps } = await generator.install(dep);
    if (doPreload && preload) {
      for (const url of [...staticDeps])
        staticPreloads.add(url);
      for (const url of [...dynamicDeps])
        dynPreloads.add(url);
    }
  }
    
  const map = generator.getMap();
  map.imports = map.imports || {};

  for (const url of staticPreloads) {
    if (dynPreloads.has(url))
      dynPreloads.delete(url);
  }

  const preloads = await Promise.all([
    ...[...staticPreloads].sort(),
    ...[...dynPreloads].sort()
  ].map(async url => {
    if (integrity)
      return { url, integrity: await getIntegrity(url) };
    return { url };
  }));
  return { map, preloads };
}

export async function resolvePkg (depStr) {
  await initPromise;
  if (depStr === 'err')
    return { err: `Unable to find package ${depStr}` };
  try {
    var { install, resolved } = await lookup(depStr);
  }
  catch (e) {
    return { err: e.message };
  }
  if (install.alias !== resolved.name)
    return { err: 'Invalid name format' };
  try {
    return { subpath: install.subpath, ...resolved };
  }
  catch (e) {
    return { err: e.message };
  }
}

export async function getVersions (name) {
  await initPromise;
  const res = await fetch(`https://npmlookup.jspm.io/${encodeURIComponent(name)}`);
  if (!res.ok) {
    toast(`Error: Unable to get version list for ${name} (${res.status})`);
    return;
  }
  const json = await res.json();
  return Object.keys(json.versions).sort(Semver.compare).reverse();
}

export async function getExports (name, version) {
  await initPromise;
  const pcfg = await getPackageConfig(`https://ga.jspm.io/npm:${name}@${version}/`);
  if (!pcfg)
    toast(`Error: Unable to load package configuration for ${name}@${version}.`);
  else
    return Object.keys(pcfg.exports).filter(expt => !expt.endsWith('!cjs') && !expt.endsWith('/') && expt.indexOf('*') === -1).sort();
}
