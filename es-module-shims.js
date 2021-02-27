/* ES Module Shims 0.10.0 */
(function () {
  'use strict';

  const resolvedPromise = Promise.resolve();

  let baseUrl;

  function createBlob (source, type = 'text/javascript') {
    return URL.createObjectURL(new Blob([source], { type }));
  }

  const hasDocument = typeof document !== 'undefined';

  // support browsers without dynamic import support (eg Firefox 6x)
  let supportsDynamicImport = false;
  let dynamicImport;
  try {
    dynamicImport = (0, eval)('u=>import(u)');
    supportsDynamicImport = true;
  }
  catch (e) {
    if (hasDocument) {
      let err;
      self.addEventListener('error', e => err = e.error);
      dynamicImport = blobUrl => {
        const topLevelBlobUrl = createBlob(
          `import*as m from'${blobUrl}';self._esmsm=m`
        );
        const s = document.createElement('script');
        s.type = 'module';
        s.src = topLevelBlobUrl;
        document.head.appendChild(s);
        return new Promise((resolve, reject) => {
          s.addEventListener('load', () => {
            document.head.removeChild(s);
            if ('_esmsm' in self) {
              resolve(self._esmsm, baseUrl);
              delete self._esmsm;
            }
            else {
              reject(err);
            }
          });
        });
      };
    }
  }

  let supportsImportMeta = false;
  let supportsImportMaps = false;

  const featureDetectionPromise = Promise.all([
    dynamicImport(createBlob('import.meta')).then(() => supportsImportMeta = true),
    supportsDynamicImport && new Promise(resolve => {
      self._$s = v => {
        if (v) supportsImportMaps = true;
        delete self._$s;
        resolve();
      };
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = createBlob(`<script type=importmap>{"imports":{"x":"data:text/javascript,"}}<${''}/script><script>import('x').then(()=>1,()=>0).then(v=>parent._$s(v))<${''}/script>`, 'text/html');
      document.body.appendChild(iframe);
    })
  ]);

  if (hasDocument) {
    const baseEl = document.querySelector('base[href]');
    if (baseEl)
      baseUrl = baseEl.href;
  }

  if (!baseUrl && typeof location !== 'undefined') {
    baseUrl = location.href.split('#')[0].split('?')[0];
    const lastSepIndex = baseUrl.lastIndexOf('/');
    if (lastSepIndex !== -1)
      baseUrl = baseUrl.slice(0, lastSepIndex + 1);
  }

  const backslashRegEx = /\\/g;
  function resolveIfNotPlainOrUrl (relUrl, parentUrl) {
    // strip off any trailing query params or hashes
    parentUrl = parentUrl && parentUrl.split('#')[0].split('?')[0];
    if (relUrl.indexOf('\\') !== -1)
      relUrl = relUrl.replace(backslashRegEx, '/');
    // protocol-relative
    if (relUrl[0] === '/' && relUrl[1] === '/') {
      return parentUrl.slice(0, parentUrl.indexOf(':') + 1) + relUrl;
    }
    // relative-url
    else if (relUrl[0] === '.' && (relUrl[1] === '/' || relUrl[1] === '.' && (relUrl[2] === '/' || relUrl.length === 2 && (relUrl += '/')) ||
        relUrl.length === 1  && (relUrl += '/')) ||
        relUrl[0] === '/') {
      const parentProtocol = parentUrl.slice(0, parentUrl.indexOf(':') + 1);
      // Disabled, but these cases will give inconsistent results for deep backtracking
      //if (parentUrl[parentProtocol.length] !== '/')
      //  throw new Error('Cannot resolve');
      // read pathname from parent URL
      // pathname taken to be part after leading "/"
      let pathname;
      if (parentUrl[parentProtocol.length + 1] === '/') {
        // resolving to a :// so we need to read out the auth and host
        if (parentProtocol !== 'file:') {
          pathname = parentUrl.slice(parentProtocol.length + 2);
          pathname = pathname.slice(pathname.indexOf('/') + 1);
        }
        else {
          pathname = parentUrl.slice(8);
        }
      }
      else {
        // resolving to :/ so pathname is the /... part
        pathname = parentUrl.slice(parentProtocol.length + (parentUrl[parentProtocol.length] === '/'));
      }

      if (relUrl[0] === '/')
        return parentUrl.slice(0, parentUrl.length - pathname.length - 1) + relUrl;

      // join together and split for removal of .. and . segments
      // looping the string instead of anything fancy for perf reasons
      // '../../../../../z' resolved to 'x/y' is just 'z'
      const segmented = pathname.slice(0, pathname.lastIndexOf('/') + 1) + relUrl;

      const output = [];
      let segmentIndex = -1;
      for (let i = 0; i < segmented.length; i++) {
        // busy reading a segment - only terminate on '/'
        if (segmentIndex !== -1) {
          if (segmented[i] === '/') {
            output.push(segmented.slice(segmentIndex, i + 1));
            segmentIndex = -1;
          }
        }

        // new segment - check if it is relative
        else if (segmented[i] === '.') {
          // ../ segment
          if (segmented[i + 1] === '.' && (segmented[i + 2] === '/' || i + 2 === segmented.length)) {
            output.pop();
            i += 2;
          }
          // ./ segment
          else if (segmented[i + 1] === '/' || i + 1 === segmented.length) {
            i += 1;
          }
          else {
            // the start of a new segment as below
            segmentIndex = i;
          }
        }
        // it is the start of a new segment
        else {
          segmentIndex = i;
        }
      }
      // finish reading out the last segment
      if (segmentIndex !== -1)
        output.push(segmented.slice(segmentIndex));
      return parentUrl.slice(0, parentUrl.length - pathname.length) + output.join('');
    }
  }

  /*
   * Import maps implementation
   *
   * To make lookups fast we pre-resolve the entire import map
   * and then match based on backtracked hash lookups
   *
   */
  function resolveUrl (relUrl, parentUrl) {
    return resolveIfNotPlainOrUrl(relUrl, parentUrl) || (relUrl.indexOf(':') !== -1 ? relUrl : resolveIfNotPlainOrUrl('./' + relUrl, parentUrl));
  }

  function resolveAndComposePackages (packages, outPackages, baseUrl, parentMap, scopeUrl) {
    for (let p in packages) {
      const resolvedLhs = resolveIfNotPlainOrUrl(p, scopeUrl || baseUrl) || p;
      let target = packages[p];
      if (typeof target !== 'string') 
        continue;
      const mapped = resolveImportMap(parentMap, resolveIfNotPlainOrUrl(target, baseUrl) || target, baseUrl);
      if (mapped) {
        outPackages[resolvedLhs] = mapped;
        continue;
      }
      targetWarning(p, packages[p], 'bare specifier did not resolve');
    }
  }

  function resolveAndComposeImportMap (json, baseUrl, parentMap) {
    const outMap = { imports: Object.assign({}, parentMap.imports), scopes: Object.assign({}, parentMap.scopes) };

    if (json.imports)
      resolveAndComposePackages(json.imports, outMap.imports, baseUrl, parentMap, null);

    if (json.scopes)
      for (let s in json.scopes) {
        const resolvedScope = resolveUrl(s, baseUrl);
        resolveAndComposePackages(json.scopes[s], outMap.scopes[resolvedScope] || (outMap.scopes[resolvedScope] = {}), baseUrl, parentMap, resolvedScope);
      }

    return outMap;
  }

  function getMatch (path, matchObj) {
    if (matchObj[path])
      return path;
    let sepIndex = path.length;
    do {
      const segment = path.slice(0, sepIndex + 1);
      if (segment in matchObj)
        return segment;
    } while ((sepIndex = path.lastIndexOf('/', sepIndex - 1)) !== -1)
  }

  function applyPackages (id, packages) {
    const pkgName = getMatch(id, packages);
    if (pkgName) {
      const pkg = packages[pkgName];
      if (pkg === null) return;
      if (id.length > pkgName.length && pkg[pkg.length - 1] !== '/')
        targetWarning(pkgName, pkg, "should have a trailing '/'");
      else
        return pkg + id.slice(pkgName.length);
    }
  }

  function targetWarning (match, target, msg) {
    console.warn("Package target " + msg + ", resolving target '" + target + "' for " + match);
  }

  function resolveImportMap (importMap, resolvedOrPlain, parentUrl) {
    let scopeUrl = parentUrl && getMatch(parentUrl, importMap.scopes);
    while (scopeUrl) {
      const packageResolution = applyPackages(resolvedOrPlain, importMap.scopes[scopeUrl]);
      if (packageResolution)
        return packageResolution;
      scopeUrl = getMatch(scopeUrl.slice(0, scopeUrl.lastIndexOf('/')), importMap.scopes);
    }
    return applyPackages(resolvedOrPlain, importMap.imports) || resolvedOrPlain.indexOf(':') !== -1 && resolvedOrPlain;
  }

  /* es-module-lexer 0.4.0 */
  const A=1===new Uint8Array(new Uint16Array([1]).buffer)[0];function parse(E,g="@"){if(!B)return init.then(()=>parse(E));const I=E.length+1,D=(B.__heap_base.value||B.__heap_base)+4*I-B.memory.buffer.byteLength;D>0&&B.memory.grow(Math.ceil(D/65536));const w=B.sa(I-1);if((A?C:Q)(E,new Uint16Array(B.memory.buffer,w,I)),!B.parse())throw Object.assign(new Error(`Parse error ${g}:${E.slice(0,B.e()).split("\n").length}:${B.e()-E.lastIndexOf("\n",B.e()-1)}`),{idx:B.e()});const L=[],k=[];for(;B.ri();){const A=B.is(),Q=B.ie();let C;B.ip()&&(C=N(E.slice(A-1,Q+1))),L.push({n:C,s:A,e:Q,ss:B.ss(),se:B.se(),d:B.id()});}for(;B.re();)k.push(E.slice(B.es(),B.ee()));function N(A){try{return (0,eval)(A)}catch{}}return [L,k,!!B.f()]}function Q(A,Q){const C=A.length;let B=0;for(;B<C;){const C=A.charCodeAt(B);Q[B++]=(255&C)<<8|C>>>8;}}function C(A,Q){const C=A.length;let B=0;for(;B<C;)Q[B]=A.charCodeAt(B++);}let B;const init=WebAssembly.compile((E="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","undefined"!=typeof window&&"function"==typeof atob?Uint8Array.from(atob(E),A=>A.charCodeAt(0)):Buffer.from(E,"base64"))).then(WebAssembly.instantiate).then(({exports:A})=>{B=A;});var E;

  let id = 0;
  const registry = {};

  async function loadAll (load, seen) {
    if (load.b || seen[load.u])
      return;
    seen[load.u] = 1;
    await load.L;
    return Promise.all(load.d.map(dep => loadAll(dep, seen)));
  }

  let waitingForImportMapsInterval;
  let firstTopLevelProcess = true;
  async function topLevelLoad (url, source, polyfill) {
    // no need to even fetch if we have feature support
    await featureDetectionPromise;
    // early analysis opt-out
    if (supportsDynamicImport && supportsImportMeta && supportsImportMaps && !importMapSrcOrLazy) {
      // dont reexec inline for polyfills -> just return null
      return source && polyfill ? null : dynamicImport(url || createBlob(source));
    }
    if (waitingForImportMapsInterval > 0) {
      clearTimeout(waitingForImportMapsInterval);
      waitingForImportMapsInterval = 0;
    }
    if (firstTopLevelProcess) {
      firstTopLevelProcess = false;
      processScripts();
    }
    await importMapPromise;
    await init;
    const load = getOrCreateLoad(url, source);
    const seen = {};
    await loadAll(load, seen);
    lastLoad = undefined;
    resolveDeps(load, seen);
    // inline "module-shim" must still execute even if no shim
    if (source && !polyfill && !load.n)
      return dynamicImport(createBlob(source));
    const module = await dynamicImport(load.b);
    // if the top-level load is a shell, run its update function
    if (load.s)
      (await dynamicImport(load.s)).u$_(module);
    return module;
  }

  async function importShim (id, parentUrl = baseUrl) {
    return topLevelLoad(resolve(id, parentUrl).r || throwUnresolved(id, parentUrl));
  }

  self.importShim = importShim;

  const meta = {};

  const edge = navigator.userAgent.match(/Edge\/\d\d\.\d+$/);

  async function importMetaResolve (id, parentUrl = this.url) {
    await importMapPromise;
    return resolve(id, `${parentUrl}`).r || throwUnresolved(id, parentUrl);
  }

  self._esmsm = meta;

  const esmsInitOptions = self.esmsInitOptions || {};
  delete self.esmsInitOptions;
  const shimMode = typeof esmsInitOptions.shimMode === 'boolean' ? esmsInitOptions.shimMode : !!esmsInitOptions.fetch || !!document.querySelector('script[type="module-shim"],script[type="importmap-shim"]');
  const fetchHook = esmsInitOptions.fetch || (url => fetch(url));
  const skip = esmsInitOptions.skip || /^https?:\/\/(cdn\.skypack\.dev|jspm\.dev)\//;
  const onerror = esmsInitOptions.onerror || ((e) => { throw e; });

  let lastLoad;
  function resolveDeps (load, seen) {
    if (load.b || !seen[load.u])
      return;
    seen[load.u] = 0;

    for (const dep of load.d) {
      resolveDeps(dep, seen);
      if (dep.n)
        load.n = true;
    }

    if (!load.n && !shimMode) {
      load.b = lastLoad = load.u;
      load.S = undefined;
      return;
    }

    const [imports] = load.a;

    // "execution"
    const source = load.S;

    // edge doesnt execute sibling in order, so we fix this up by ensuring all previous executions are explicit dependencies
    let resolvedSource = edge && lastLoad ? `import '${lastLoad}';` : '';  

    if (!imports.length) {
      resolvedSource += source;
    }
    else {
      // once all deps have loaded we can inline the dependency resolution blobs
      // and define this blob
      let lastIndex = 0, depIndex = 0;
      for (const { s: start, e: end, d: dynamicImportIndex, n } of imports) {
        // dependency source replacements
        if (dynamicImportIndex === -1) {
          const depLoad = load.d[depIndex++];
          let blobUrl = depLoad.b;
          if (!blobUrl) {
            // circular shell creation
            if (!(blobUrl = depLoad.s)) {
              blobUrl = depLoad.s = createBlob(`export function u$_(m){${
                depLoad.a[1].map(
                  name => name === 'default' ? `$_default=m.default` : `${name}=m.${name}`
                ).join(',')
              }}${
                depLoad.a[1].map(name =>
                  name === 'default' ? `let $_default;export{$_default as default}` : `export let ${name}`
                ).join(';')
              }\n//# sourceURL=${depLoad.r}?cycle`);
            }
          }
          // circular shell execution
          else if (depLoad.s) {
            resolvedSource += source.slice(lastIndex, start - 1) + '/*' + source.slice(start - 1, end + 1) + '*/' + source.slice(start - 1, start) + blobUrl + source[end] + `;import*as m$_${depIndex} from'${depLoad.b}';import{u$_ as u$_${depIndex}}from'${depLoad.s}';u$_${depIndex}(m$_${depIndex})`;
            lastIndex = end + 1;
            depLoad.s = undefined;
            continue;
          }
          resolvedSource += source.slice(lastIndex, start - 1) + '/*' + source.slice(start - 1, end + 1) + '*/' + source.slice(start - 1, start) + blobUrl;
          lastIndex = end;
        }
        // import.meta
        else if (dynamicImportIndex === -2) {
          meta[load.r] = { url: load.r, resolve: importMetaResolve };
          resolvedSource += source.slice(lastIndex, start) + 'self._esmsm[' + JSON.stringify(load.r) + ']';
          lastIndex = end;
        }
        // dynamic import
        else {
          resolvedSource += source.slice(lastIndex, dynamicImportIndex + 6) + 'Shim(' + source.slice(start, end) + ', ' + JSON.stringify(load.r);
          lastIndex = end;
        }
      }

      resolvedSource += source.slice(lastIndex);
    }

    if (resolvedSource.indexOf('//# sourceURL=') === -1)
      resolvedSource += '\n//# sourceURL=' + load.r;

    load.b = lastLoad = createBlob(resolvedSource);
    load.S = undefined;
  }

  function getOrCreateLoad (url, source) {
    let load = registry[url];
    if (load)
      return load;

    load = registry[url] = {
      // url
      u: url,
      // response url
      r: undefined,
      // fetchPromise
      f: undefined,
      // source
      S: undefined,
      // linkPromise
      L: undefined,
      // analysis
      a: undefined,
      // deps
      d: undefined,
      // blobUrl
      b: undefined,
      // shellUrl
      s: undefined,
      // needsShim
      n: false,
    };

    load.f = (async () => {
      if (!source) {
        const res = await fetchHook(url, { credentials: 'same-origin' });
        if (!res.ok)
          throw new Error(`${res.status} ${res.statusText} ${res.url}`);
        load.r = res.url;
        const contentType = res.headers.get('content-type');
        if (contentType.match(/^(text|application)\/(x-)?javascript(;|$)/))
          source = await res.text();
        else
          throw new Error(`Unknown Content-Type "${contentType}"`);
      }
      try {
        load.a = parse(source, load.u);
      }
      catch (e) {
        console.warn(e);
        load.a = [[], []];
      }
      load.S = source;
      // determine if this source needs polyfilling
      for (const { e: end, d: dynamicImportIndex, n } of load.a[0]) {
        if (dynamicImportIndex === -2) {
          if (!supportsImportMeta || source.slice(end, end + 8) === '.resolve') {
            load.n = true;
            break;
          }
        }
        else if (dynamicImportIndex !== -1) {
          if (!supportsDynamicImport || (!supportsImportMaps || importMapSrcOrLazy) && n && resolve(n, load.r || load.u).m || !n && hasImportMap) {
            load.n = true;
            break;
          }
        }
      }
      return load.a[0].filter(d => d.d === -1).map(d => d.n);
    })();

    load.L = load.f.then(async deps => {
      load.d = await Promise.all(deps.map(async depId => {
        const { r, m } = resolve(depId, load.r || load.u);
        if (!r)
          throwUnresolved(depId, load.r || load.u);
        if (m && (!supportsImportMaps || importMapSrcOrLazy))
          load.n = true;
        if (skip.test(r))
          return { b: r };
        const depLoad = getOrCreateLoad(r);
        await depLoad.f;
        return depLoad;
      }));
    });

    return load;
  }

  let importMap = { imports: {}, scopes: {} };
  let importMapSrcOrLazy = false;
  let hasImportMap = false;
  let importMapPromise = resolvedPromise;

  if (hasDocument) {
    processScripts();
    waitingForImportMapsInterval = setInterval(processScripts, 20);
  }

  async function processScripts () {
    if (waitingForImportMapsInterval > 0 && document.readyState !== 'loading') {
      clearTimeout(waitingForImportMapsInterval);
      waitingForImportMapsInterval = 0;
    }
    for (const script of document.querySelectorAll('script[type="module-shim"],script[type="importmap-shim"],script[type="module"],script[type="importmap"]'))
      await processScript(script);
  }

  new MutationObserver(mutations => {
    for (const mutation of mutations) {
      if (mutation.type !== 'childList') continue;
      for (const node of mutation.addedNodes) {
        if (node.tagName === 'SCRIPT' && node.type)
          processScript(node, !firstTopLevelProcess);
      }
    }
  }).observe(document, { childList: true, subtree: true });

  async function processScript (script, dynamic) {
    if (script.ep) // ep marker = script processed
      return;
    const shim = script.type.endsWith('shim');
    if (!shim && shimMode || script.getAttribute('noshim') !== null)
      return;
    if (!script.src && !script.innerHTML)
      return;
    script.ep = true;
    if (script.type.startsWith('module')) {
      await topLevelLoad(script.src || `${baseUrl}?${id++}`, !script.src && script.innerHTML, !shim).catch(onerror);
    }
    else if (script.type.startsWith('importmap')) {
      importMapPromise = importMapPromise.then(async () => {
        if (script.src || dynamic)
          importMapSrcOrLazy = true;
        hasImportMap = true;
        importMap = resolveAndComposeImportMap(script.src ? await (await fetchHook(script.src)).json() : JSON.parse(script.innerHTML), script.src || baseUrl, importMap);
      });
    }
  }

  function resolve (id, parentUrl) {
    const urlResolved = resolveIfNotPlainOrUrl(id, parentUrl);
    const resolved = resolveImportMap(importMap, urlResolved || id, parentUrl);
    return { r: resolved, m: urlResolved !== resolved };
  }

  function throwUnresolved (id, parentUrl) {
    throw Error("Unable to resolve specifier '" + id + (parentUrl ? "' from " + parentUrl : "'"));
  }

}());
