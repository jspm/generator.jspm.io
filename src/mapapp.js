import './progress.js';
import './select.js';
import './help.js';
import { highlight, copyToClipboard, download, getIdentifier } from './utils.js';
import { toast } from './toast.js';
import { getSandboxHash, hashToState, stateToHash } from './statehash.js';
import { getESModuleShimsScript, getSystemScripts, getMap } from './api.js';
import { initDependencies, onDepChange } from './dependencies.js';
import './dragdrop.js';

const htmlTemplate = ({ editUrl, boilerplate, title, scripts, map, system, preloads, minify, integrity: useIntegrity }) => {
  const nl = minify ? '' : '\n';
  let scriptType, linkType, mapType;
  if (system) {
    scriptType = 'systemjs-module';
    linkType = 'script';
    mapType = 'systemjs-importmap';
  }
  else {
    scriptType = 'module';
    linkType = 'modulepreload';
    mapType = 'importmap';
  }
  const injection = `${
    map ? `\n<!--\n  JSPM Generator Import Map\n  Edit URL: ${editUrl}\n-->\n <script type="${mapType}">${nl}${JSON.stringify(map, null, nl ? 2 : 0)}${nl}</script>` : ''
  }${nl}${
    scripts ? '\n' + scripts.filter(({ hidden }) => !hidden || boilerplate && !minify).map(({ url, integrity, hidden, async, module, comment, crossorigin }) =>
      `${comment && !minify ? `<!--${comment.indexOf('\n') !== -1 ? '\n  ' : ' '}${comment.split('\n').join('\n  ')}${comment.indexOf('\n') !== -1 ? '\n' : ' '}-->\n` : ''}${hidden ? '<!-- ' : ''}<script ${async ? 'async ' : ''}${module ? 'type="module" ' : ''}src="${url}"${useIntegrity && integrity ? ` integrity="${integrity}"` : ''}${crossorigin ? ' crossorigin="anonymous"' : ''}></script>${hidden ? ' -->' : ''}`
    ).join(nl + nl) : ''
  }${
    preloads ? nl + '\n' + preloads.map(({ url, integrity }) =>
      `<link ${linkType === 'modulepreload' ? 'rel="modulepreload"' : `rel="preload" as="${linkType}"`} href="${url}"${linkType !== 'modulepreload' ? ' crossorigin="anonymous"' : ''}${useIntegrity && integrity ? ` integrity="${integrity}"` : ''}/>`
    ).join(nl) : ''
  }${
    boilerplate && !minify && !system && Object.keys(map.imports).length ? `\n\n<script type="${scriptType}">${nl}  ${Object.keys(map.imports).map(specifier =>
      `import * as ${getIdentifier(specifier)} from "${specifier}";`
    ).join(nl + '  ')}${nl}${nl}  // Write main module code here, or as a separate file with a "src" attribute on the module script.${nl}  console.log(${Object.keys(map.imports).map(getIdentifier).join(', ')});\n</script>` : ''
  }${
    boilerplate && !minify && system ? `\n\n<!-- For testing: -->\n<script>${nl}  ${Object.keys(map.imports).map(specifier =>
  `System.import("${specifier}").then(m => console.log(m));`
).join(nl + '  ')}\n</script>` : ''
  }${
    boilerplate && !minify && system ? `\n\n<!-- Load an app.js file written in the "system" module format output (via RollupJS / Babel / TypeScript) -->
<!-- <script type="${scriptType}" src="app.js"></script> -->` : ''
  }`;
  if (!boilerplate)
    return injection.slice(1);
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body>${injection ? injection.split('\n').join('\n  ') : ''}
</body>\n</html>
`;
};

class ImportMapApp {
  constructor (initState) {
    this.job = 0;
    this.$code = document.querySelector('.container pre code');
    for (const check of document.querySelectorAll('.env .checkbox'))
      check.addEventListener('change', this.envChange.bind(this));
    for (const outputOption of document.querySelectorAll('.buttonbar .checkbox'))
      outputOption.addEventListener('change', this.outputChange.bind(this));
    this.$providerSelector = document.querySelector('.provider select-box');
    this.$providerSelector.addEventListener('change', this.providerChange.bind(this));
    document.querySelector('#btn-copy').addEventListener('click', () => {
      if (!this.code) {
        toast('Nothing to copy.');
      }
      else {
        copyToClipboard(this.code)
        toast(`${this.state.output.json ? 'JSON' : 'HTML'} copied to clipboard.`);
      }
    });
    document.querySelector('#btn-download').addEventListener('click', () => {
      if (!this.code)
        toast('Nothing to download.');
      else
        download(this.code, this.state.name + (this.state.output.json ? '.json' : '.html'));
    });
    document.querySelector('#btn-copy-share').addEventListener('click', async () => {
      if (this.state.output.json) {
        toast('The JSPM Sandbox only supports HTML apps.');
      }
      else if (!this.code) {
        toast('Nothing to copy.');
      }
      else {
        window.open(`https://jspm.org/sandbox${await getSandboxHash(this.code)}`, '_blank');
      }
    });
    document.querySelector('.title input').addEventListener('change', e => {
      const value = e.target.value;
      if (value !== this.state.name) {
        this.state.name = value;
        this.renderMap();
      }
    });
    document.querySelector('#btn-upload-package-json').addEventListener('click', () => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'application/JSON'
      input.onchange = async () => {
        const file =   Array.from(input.files)[0];
        this.processJSONFile(file)
      }
      input.click();
    });
    onDepChange(newDeps => {
      if (JSON.stringify(newDeps) === JSON.stringify(this.state.deps))
        return;
      this.state.deps = newDeps;
      this.renderMap();
    });
    this.$progressBar = document.querySelector('progress-bar.main');
    this.$progressBar.setEstimate(10000);
    window.addEventListener('popstate', async () => {
      if (this.stateHash !== location.hash) {
        const prevDeps = this.state.deps;
        try {
          this.state = await hashToState(location.hash);
        }
        catch (e) {
          console.error(e);
          return;
        }
        if (JSON.stringify(prevDeps) !== JSON.stringify(this.state.deps))
          initDependencies(this.state.deps);
        this.renderMap();
      }
    });

    this.state = initState;
    this.firstRender = true;
    this.renderMap();
  }

  providerChange (e) {
    this.state.provider = e.detail.new;
    this.renderMap();
  }

  async renderMap () {
    const job = ++this.job;

    let stateHash;
    if (this.firstRender) {
      if (location.hash.length > 2) {
        let state;
        try {
          state = await hashToState(location.hash);
        }
        catch {}
        if (state) {
          this.state = state;
          stateHash = location.hash;
        }
      }
      if (!stateHash && localStorage) {
        const lastHash = localStorage.getItem('lastHash');
        let state;
        try {
          if (lastHash)
            state = await hashToState(lastHash);
        }
        catch {}
        if (state)
          this.state = state;
      }

      initDependencies(this.state.deps);
    }

    if (!stateHash) {
      stateHash = await stateToHash(this.state);
      if (location.hash !== stateHash) {
        if (this.firstRender)
          history.replaceState(true, null, stateHash);
        else
          window.history.pushState(null, document.title, stateHash);
      }
    }

    if (localStorage)
      localStorage.setItem('lastHash', stateHash);

    if (this.job !== job) return;
    
    this.stateHash = stateHash;
    this.firstRender = false;

    document.title = this.state.name + ' - Import Map Generator - JSPM.IO';
    document.querySelector('.title input').value = this.state.name;

    this.$providerSelector.set(this.state.provider);
    for (const check of document.querySelectorAll('.env .checkbox'))
      check.checked = this.state.env[check.id.slice(4)];
    for (const outputOption of document.querySelectorAll('.buttonbar .checkbox')) {
      const name = outputOption.id.slice(4);
      const checked = this.state.output[name];
      if (name === 'preload')
        document.querySelector('.dependencies').className = 'dependencies' + (checked ? '' : ' nopreload');
      outputOption.checked = checked;
    }

    this.$progressBar.addWork();
    
    try {
      await new Promise(resolve => setTimeout(resolve, 300));
      if (this.job !== job) return;

      let { map, preloads } = await getMap(this.state.deps, this.state.output.integrity, this.state.output.preload, this.state.env, this.state.provider);

      const scripts = this.state.output.system ? await getSystemScripts(this.state.output.integrity) : await getESModuleShimsScript(this.state.output.integrity);

      if (this.state.output.system) {
        function systemReplace (url) {
          return url.replace(/^https:\/\/ga\.jspm\.io\//g, 'https://ga.system.jspm.io/');
        }
        if (preloads)
          preloads = preloads.map(preload => ({ ...preload, url: systemReplace(preload.url) }));
        if (map.imports) {
          for (const impt of Object.keys(map.imports))
            map.imports[impt] = systemReplace(map.imports[impt]);
        }
        if (map.scopes) {
          for (const key of Object.keys(map.scopes)) {
            const scope = map.scopes[key];
            delete map.scopes[key];
            map.scopes[systemReplace(key)] = scope;
            for (const impt of Object.keys(scope))
              scope[impt] = systemReplace(scope[impt]);
          }
        }
      }

      if (this.state.output.json)
        this.setCode(JSON.stringify(map, null, this.state.output.minify ? 0 : 2));
      else
        this.setCode(htmlTemplate({
          editUrl: location.href,
          boilerplate: this.state.output.boilerplate,
          title: this.state.name,
          scripts,
          system: this.state.output.system,
          map,
          preloads: this.state.output.preload ? preloads : null,
          minify: this.state.output.minify,
          integrity: this.state.output.integrity
        }));
    }
    catch (e) {
      console.error(e);
      this.setError(e.toString());
      toast('Error creating import map.');
    }
    finally {
      if (this.job !== job) return;
      this.$progressBar.complete();
      document.querySelector('.depbox').focus();
    }
  }
  outputChange (e) {
    const outputOption = e.target.id.slice(4);
    this.state.output[outputOption] = e.target.checked;
    if (outputOption === 'preload' && !e.target.checked) {
      document.querySelector('#map-integrity').checked = false;
      this.state.output.integrity = false;
    }
    if (outputOption === 'json' && e.target.checked) {
      document.querySelector('#map-boilerplate').checked = false;
      this.state.output.boilerplate = false;
      document.querySelector('#map-integrity').checked = false;
      this.state.output.integrity = false;
    }
    if ((outputOption === 'boilerplate' || outputOption === 'integrity') && e.target.checked) {
      document.querySelector('#map-json').checked = false;
      this.state.output.json = false;
    }
    if (outputOption === 'integrity' && e.target.checked) {
      this.state.output.preload = true;
    }
    this.renderMap();
  }
  envChange (e) {
    const condition = e.target.id.slice(4);
    const value = e.target.checked;
    switch (condition) {
      case 'production':
        document.querySelector('#env-development').checked = !value;
        this.state.env.development = !value;
      break;

      case 'development':
        document.querySelector('#env-production').checked = !value;
        this.state.env.production = !value;
      break;

      case 'browser':
        if (value) {
          if (!this.state.env.deno) {
            document.querySelector('#env-node').checked = false;
            this.state.env.node = false;
          }
        }
      break;

      case 'node':
        if (value) {
          if (!this.state.env.deno) {
            document.querySelector('#env-browser').checked = false;
            this.state.env.browser = false;
          }
        }
      break;

      case 'deno':
        if (value) {
          document.querySelector('#env-node').checked = true;
          this.state.env.node = true;
          document.querySelector('#map-json').checked = true;
          this.state.output.json = true;
          document.querySelector('#env-browser').checked = false;
          this.state.env.browser = false;
        }
        else if (this.state.env.node && this.state.env.browser) {
          this.state.env.node = false;
          document.querySelector('#env-node').checked = false;
        }
      break;
    }
    this.state.env[condition] = value;
    this.renderMap();
  }
  setError (err) {
    this.code = undefined;
    this.$code.innerHTML = err.replace(/</g, '&lt;');
    this.$code.className = 'error';
  }
  setCode (code) {
    this.code = code;
    this.$code.innerHTML = highlight(code.replace(/</g, '&lt;'));
    this.$code.className = '';
  }
}

export default new ImportMapApp({
  name: 'Untitled',
  provider: 'jspm.io',
  deps: [],
  env: {
    development: true,
    production: false,
    browser: true,
    node: false,
    module: true,
    deno: false
  },
  output: {
    system: false,
    boilerplate: true,
    minify: false,
    json: false,
    integrity: false,
    preload: false
  }
});
