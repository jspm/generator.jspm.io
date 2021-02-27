import TraceMap from '../lib/tracemap/tracemap.js';
import { Semver } from 'sver';
import resolver from '../lib/install/resolver.js';
import { toast } from './toast.js';
import { computeIntegrity } from '../lib/common/integrity.js';
import { toPackageTarget, isPackageTarget } from '../lib/install/package.js';

let esModuleShimsIntegrity;
export async function getESModuleShimsScript (integrity) {
  // = resolvePkg + integrity()
  return [{
    defer: true,
    url: 'https://ga.jspm.io/npm:es-module-shims@0.10.0/dist/es-module-shims.min.js',
    integrity: '',
    comment: 'ES Module Shims: Import maps polyfill for modules browsers without import maps support (all except Chrome 89+)'
  }];
}

let systemIntegrity, systemBabelIntegrity;
export async function getSystemScripts (integrity) {
  // = resolvePkg + integrity()
  return [
    {
      comment: 'SystemJS: Supports loading modules performantly in all browsers back to IE11 (depending on library support)',
      url: 'https://ga.system.jspm.io/npm:systemjs@6.8.3/dist/s.min.js',
      integrity: ''
    },
    {
      hidden: true,
      comment: 'Uncomment SystemJS Babel below for an in-browser ES Module / TypeScript / JSX dev workflow.',
      url: 'https://ga.system.jspm.io/npm:systemjs-babel@0.3.1/dist/systemjs-babel.js',
      integrity: ''
    }
  ];
}

export async function getMap (deps, integrity, preload, env) {
  // deps = [[name@version/subpath, preload?], ...]
  const modules = deps.map(dep => dep[0]);

  if (!modules.length) {
    return { map: { imports: {} } };
  }

  const base = new URL('/', location);

  const traceMap = new TraceMap(base, {
    stdlib: '@jspm/core@2',
    lock: false,
    env: Object.keys(env).filter(name => env[name])
  });

  const finishInstall = await traceMap.startInstall();
  try {
    await Promise.all(modules.map(async targetStr => {
      let module;
      if (isPackageTarget(targetStr)) {
        const { alias, target, subpath } = await toPackageTarget(targetStr, base);
        await traceMap.add(alias, target);
        module = alias + subpath.slice(1);
      }
      else {
        module = new URL(targetStr, baseUrl).href;
      }
      return traceMap.trace(module);
    }));
    await finishInstall(true);
    const map = traceMap.map;
    map.flatten();
    map.rebase();
    map.sort();

    // let preloads: Script[] | undefined;
    // if (opts.preload || opts.integrity)
    //  preloads = traceMap.getPreloads(!!opts.integrity, baseUrl);

    return { map: map.toJSON() };
  }
  catch (e) {
    console.log('ERROR');
    console.log(e);
    finishInstall(false);
    throw e;
  }
}

export async function resolvePkg (depStr) {
  if (depStr === 'err')
    return { err: `Unable to find package ${depStr}` };
  let target, subpath, alias;
  try {
    ({ target, subpath, alias } = await toPackageTarget(depStr));
  }
  catch (e) {
    return { err: e.message };
  }
  if (alias !== target.name)
    return { err: 'Invalid name format' };
  try {
    const resolved = await resolver.resolveLatestTarget(target, true);
    return { subpath, ...resolved };
  }
  catch (e) {
    return { err: e.message };
  }
}

export async function getVersions (name) {
  const res = await fetch(`https://npmlookup.jspm.io/${encodeURIComponent(name)}`);
  if (!res.ok) {
    toast(`Error: Unable to get version list for ${name} (${res.status})`);
    return;
  }
  const json = await res.json();
  return Object.keys(json.versions).sort(Semver.compare).reverse();
}

export async function getExports (name, version) {
  const pcfg = await resolver.getPackageConfig(`https://ga.jspm.io/npm:${name}@${version}/`);
  if (!pcfg)
    toast(`Error: Unable to load package configuration for ${name}@${version}.`);
  else
    return Object.keys(pcfg.exports).filter(expt => !expt.endsWith('!cjs') && !expt.endsWith('/') && expt.indexOf('*') === -1).sort();
}
