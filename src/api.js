export async function getESModuleShimsScript (integrity) {
  return [{
    url: 'https://ga.jspm.io/es-module-shims.js',
    integrity: 'sha384-fNLxbFH9hT5mhtd6OSPEPv8pEHS8nFVmSwXS0s9df8',
    defer: true
  }];
}

export async function getSystemScripts (integrity) {
  return [
    {
      url: 'https://ga.jspm.io/npm:systemjs@6.6.1/dist/s.min.js',
      integrity: 'sha384-fNLxbFH9hT5mhtd6OSPEPv8pEHS8nFVmSwXSbDfJLVR35y4+4bxpsYf/Ui3D0Af6'
    },
    {
      hidden: 'Uncomment the SystemJS Babel script below to use SystemJS in a dev mode\nto process ES modules as System modules directly in the browser.',
      url: 'https://ga.jspm.io/npm:systemjs@6.6.1/dist/system-babel.min.js',
      integrity: 'sha384-fNLxbFH9hT5mhtd6OSPEPv8pEHS8nFVmSwXSbDfJLVR35y4+4bxpsYf/Ui3D0Af6'
    }
  ];
}

function fromPkgStr (pkg) {
  const versionIndex = pkg.indexOf('@', 1);
  const name = pkg.slice(0, versionIndex);
  let subpathIndex = pkg.indexOf('/', versionIndex);
  if (subpathIndex === -1)
    subpathIndex = pkg.length;
  const version = pkg.slice(versionIndex + 1, subpathIndex);
  const subpath = '.' + pkg.slice(name.length + version.length + 1);
  return { name, version, subpath };
}

export async function getMap (deps, integrity, preload) {
  // deps = [[name, target, preload?], ... ]
  const map = {
    imports: {}
  };
  const preloads = [];
  for (const [pkg, pkgPreload] of deps) {
    const { name, version, subpath } = fromPkgStr(pkg);
    const url = `https://ga.jspm.io/npm:${name}@${version}${subpath.slice(1)}`;
    if (preload && pkgPreload)
      preloads.push({ url, integrity: 'sha384-ZzdlymbF3TYXNOnSD+aGTmh/CarZifuqLzUH5JPwpes4nPglCLAFx6fSfOv//zvd' });
    map.imports[name + subpath.slice(1)] = url;
  }
  return { map, preloads };
}

export async function resolvePkg (depStr) {
  if (depStr === 'err')
    return { err: `Unable to find package ${depStr}` };
  return {
    name: 'test',
    version: '1.2.3',
    subpath: '.', // can be undefined for not found
    err: `Unable to resolve subpath for ${depStr}`
  };
}

export async function getVersions (name) {
  await new Promise(resolve => setTimeout(resolve, 1000));
  return ['1.2.3', '2.3.4', '3.4.5', '4.5.6', '5.6.7', '6.7.8'];
}

export async function getExports (name, version) {
  await new Promise(resolve => setTimeout(resolve, 1000));
  return ['./mode/css/css', './mode/htmlmixed/htmlmixed.js', './mode/javascript/javascript.js'];
}

