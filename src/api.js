import { toast } from './toast.js';
import { SemverRange } from 'sver';

let crypto, Semver, Generator, lookup, getPackageConfig, generator;
const initPromise = (async () => {
  [
    { Semver },
    { Generator, lookup, getPackageConfig },
    { default: crypto },
  ] = await Promise.all([
    import('sver'),
    import('@jspm/generator'),
    import('@jspm/core/nodelibs/crypto'),
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

let urlCache = {};

export async function getESModuleShimsScript (integrity, provider) {
  let esmsUrl = urlCache['esms-' + provider];
  if (!esmsUrl) {
    // TODO: make this achievable via the static API
    const generator = new Generator();
    const providerObj = { provider, layer: 'default' };
    const esmsPkg = await generator.traceMap.resolver.resolveLatestTarget(
      { name: "es-module-shims", registry: "npm", ranges: [new SemverRange("*")] },
      providerObj,
    );
    esmsUrl = (await generator.traceMap.resolver.pkgToUrl(esmsPkg, providerObj)) + "dist/es-module-shims.js";
    urlCache['esms-' + provider] = esmsUrl;
  }
  return [{
    async: true,
    url: esmsUrl,
    integrity: integrity ? await getIntegrity(url) : '',
    crossorigin: true,
    comment: 'ES Module Shims: Import maps polyfill for olrder browsers without import maps support (eg Safari 16.3)'
  }];
}

export async function getSystemScripts (integrity, provider) {
  let systemUrl = urlCache['system-' + provider];
  if (!systemUrl) {
    // TODO: make this achievable via the static API
    const generator = new Generator();
    const providerObj = { provider, layer: provider === 'jspm.io' ? 'system' : 'default' };
    const systemPkg = await generator.traceMap.resolver.resolveLatestTarget(
      { name: "systemjs", registry: "npm", ranges: [new SemverRange("*")] },
      providerObj,
    );
    systemUrl = (await generator.traceMap.resolver.pkgToUrl(systemPkg, providerObj)) + "dist/s.min.js";
    urlCache['system-' + provider] = systemUrl;
  }
  return [
    {
      comment: 'SystemJS: Supports loading modules performantly in all browsers back to IE11 (depending on library support)',
      url: systemUrl,
      integrity: integrity ? await getIntegrity(systemUrl) : ''
    }
  ];
}

export async function getMap (deps, integrity, doPreload, env, provider) {
  await initPromise;
  generator = new Generator({
    env: Object.keys(env).filter(key => env[key]),
    defaultProvider: provider
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

export async function installFromDependencies(deps) {
  await initPromise;
  const installedDeps = [];

  // resolve dependency names and versions
  const progressBar = document.querySelector('progress-bar.main');
  progressBar.setEstimate(10000);

  for (let [name, range] of Object.entries(deps)) {
    let version;
    // latest version lookup
    if (range === '*' || range === 'latest' || range.startsWith('^') || range.startsWith('~')) {
      let err;
      ({ name, version, err } = await resolvePkg(name + '@' + range));
      if (err)
        throw err;
    }
    // invalid registry pointer
    else if (range.includes(':')) {
      throw new Error(`Alternative registry references not supported, installing ${name} = ${range}`);
    }
    // exact version / tag
    else {
      version = range;
    }
    progressBar.addWork();
    installedDeps.push([name + '@' + version]);
  }

  progressBar.complete();
  return installedDeps;
}
