import MagicString from 'magic-string';
import { parseTags } from './script-lexer.js';
import { removeElement, getOrCreateTag, setInnerWithIndentation, insertAfter, insertBefore } from './dom-utils.js';
function isJspmUrl(url) {
    return url.startsWith('https://ga.jspm.io/') || url.startsWith('https://system.ga.jspm.io/') || url.match(/(^|\/)(s|system|system-babel)(\.min)?\.js$/);
}
// scripts or preloads to jspm CDN or with attribute "jspm"
function removeJspmInjections(source, els) {
    for (const el of els) {
        if (el.name === 'script') {
            if (el.attributes.some(attr => attr.name === 'jspm') || el.attributes.some(attr => attr.name === 'src' && isJspmUrl(attr.value)))
                removeElement(source, el);
        }
        else if (el.name === 'link') {
            if (el.attributes.some(attr => attr.name === 'jspm') || el.attributes.some(attr => attr.name === 'rel' && (attr.value === 'modulepreload' || attr.value === 'systemjs-preload')) && el.attributes.some(attr => isJspmUrl(attr.value)))
                removeElement(source, el);
        }
    }
}
function renderScript(script, type) {
    return `<script${type ? ` type="${type}"` : ''} src="${script.url}"${script.integrity ? ` integrity="${script.integrity}"` : ''}${script.crossorigin ? ` crossorigin="${script.crossorigin}"` : ''}${script.jspm ? ' jspm' : ''}></script>`;
}
export function inject(html, injection) {
    let source = new MagicString(html);
    let els = parseTags(html);
    removeJspmInjections(source, els);
    // we always inject the import map, even if not there
    // if the map is empty we then clear at the end
    let map;
    ({ source, els, el: map } = getOrCreateTag(source, els, el => el.name === 'script' && el.attributes.some(attr => attr.name === 'type' && (attr.value === 'importmap' || attr.value === 'systemjs-importmap')), '<script type="importmap"></script>'));
    const typeAttr = map.attributes.find(attr => attr.name === 'type');
    if (typeAttr.valueStart === typeAttr.valueEnd)
        source.appendRight(typeAttr.valueStart, (injection.system ? 'systemjs-' : '') + 'importmap');
    else
        source.overwrite(typeAttr.valueStart, typeAttr.valueEnd, (injection.system ? 'systemjs-' : '') + 'importmap');
    setInnerWithIndentation(source, map, injection.importMap || {});
    if (!injection.importMap)
        removeElement(source, map);
    if (injection.systemBabel)
        insertBefore(source, map, renderScript(injection.systemBabel));
    if (injection.system)
        insertBefore(source, map, renderScript(injection.system));
    if (injection.loads) {
        for (let i = 0; i < injection.loads.length; i++)
            insertAfter(source, map, renderScript(injection.loads[i], injection.system ? 'systemjs-module' : 'module'));
    }
    if (injection.preloads) {
        for (let i = 0; i < injection.preloads.length; i++) {
            const { url, integrity, crossorigin, jspm } = injection.preloads[i];
            insertAfter(source, map, `<link rel="${injection.system ? 'systemjs-preload' : 'modulepreload'}" href="${url}"${integrity ? ` integrity="${integrity}"` : ''}${crossorigin ? ` crossorigin="${crossorigin}"` : ''}${jspm ? ' jspm' : ''} />`);
        }
    }
    return source.toString().replace(/^\s+$/mg, '');
}
// @ts-ignore
if (import.meta.main) {
    // @ts-ignore
    const { assertStrictEquals } = await import('https://deno.land/std/testing/asserts.ts');
    console.group('Injections Removal');
    {
        const source = `
      <script type="module" src=https://ga.jspm.io/x></script>
      <script type="importmap">
      {
        "imports": { "stuff": "..." }
      }
        </script>
      <link rel="modulepreload" href="./dist/x-sdf.js" jspm />
    `;
        const string = new MagicString(source);
        const scripts = parseTags(source);
        removeJspmInjections(string, scripts);
        assertStrictEquals(string.toString(), `
      <script type="importmap">
      {
        "imports": { "stuff": "..." }
      }
        </script>
    `);
    }
    console.groupEnd();
    console.group('Inject');
    {
        const html = `
      <script type="module" src=https://ga.jspm.io/x></script>
      <script type="importmap">
      {
        "imports": { "stuff": "..." }
      }
        </script>
      <link rel="modulepreload" href="./dist/x-sdf.js" jspm />
    `;
        assertStrictEquals(inject(html, { importMap: { test: 'map' } }), `
      <script type="importmap">
      {
        "test": "map"
      }
      </script>
`);
    }
    {
        const html = `
      <!doctype html>
    `;
        assertStrictEquals(inject(html, { importMap: { test: 'map' } }), `
      <!doctype html>
      <script type="importmap">
      {
        "test": "map"
      }
      </script>
`);
    }
    {
        const html = `
      <html>
        <body>
        </body>
      </html>
    `;
        assertStrictEquals(inject(html, { importMap: { test: 'map' } }), `
      <html>
        <script type="importmap">
        {
          "test": "map"
        }
        </script>
        <body>
        </body>
      </html>
`);
    }
    {
        const html = `
      <h1>hello world</h1>
    `;
        assertStrictEquals(inject(html, { importMap: { test: 'map' } }), `      <script type="importmap">
      {
        "test": "map"
      }
      </script>
      <h1>hello world</h1>
`);
    }
    {
        const html = `
      <h1>hello world</h1>
    `;
        assertStrictEquals(inject(html, { importMap: { test: 'map' }, preloads: [{ url: '/file.js', integrity: 'sha..' }, { url: '/file.js', crossorigin: 'anonymous' }] }), `      <script type="importmap">
      {
        "test": "map"
      }
      </script>
      <link rel="modulepreload" href="/file.js" integrity="sha.." />
      <link rel="modulepreload" href="/file.js" crossorigin="anonymous" />
      <h1>hello world</h1>
`);
    }
    {
        const html = `
      <h1>hello world</h1>
    `;
        assertStrictEquals(inject(html, { preloads: [{ url: '/file.js', integrity: 'sha..' }, { url: '/file.js', crossorigin: 'anonymous' }] }), `
      <link rel="modulepreload" href="/file.js" integrity="sha.." />
      <link rel="modulepreload" href="/file.js" crossorigin="anonymous" />
      <h1>hello world</h1>
`);
    }
    console.groupEnd();
    console.group('System Injections');
    {
        const html = `
      <script type="module" src=https://ga.jspm.io/x></script>
      <script type="importmap">
      {
        "imports": { "stuff": "..." }
      }
        </script>
      <link rel="modulepreload" href="./dist/x-sdf.js" jspm />
    `;
        assertStrictEquals(inject(html, { importMap: { test: 'map' }, system: { url: '/system.js' } }), `
      <script src="/system.js"></script>
      <script type="systemjs-importmap">
      {
        "test": "map"
      }
      </script>
`);
    }
    {
        const html = `
      <!doctype html>
      <script src="/system-babel.js"></script>
    `;
        assertStrictEquals(inject(html, { importMap: { test: 'map' }, system: { url: '/system.js' }, systemBabel: { url: '/system-babel.js', integrity: 'x' } }), `
      <!doctype html>
      <script src="/system.js"></script>
      <script src="/system-babel.js" integrity="x"></script>
      <script type="systemjs-importmap">
      {
        "test": "map"
      }
      </script>
`);
    }
    {
        const html = `
      <html>
        <body>
        </body>
      </html>
    `;
        assertStrictEquals(inject(html, { importMap: { test: 'map' }, system: { url: '/system.js' } }), `
      <html>
        <script src="/system.js"></script>
        <script type="systemjs-importmap">
        {
          "test": "map"
        }
        </script>
        <body>
        </body>
      </html>
`);
    }
    {
        const html = `
      <h1>hello world</h1>
    `;
        assertStrictEquals(inject(html, { importMap: { test: 'map' }, system: { url: '/system.js' } }), `      <script src="/system.js"></script>
      <script type="systemjs-importmap">
      {
        "test": "map"
      }
      </script>
      <h1>hello world</h1>
`);
    }
    {
        const html = `
      <h1>hello world</h1>
    `;
        assertStrictEquals(inject(html, { importMap: { test: 'map' }, system: { url: '/system.js' }, preloads: [{ url: '/file.js', integrity: 'sha..' }, { url: '/file.js', crossorigin: 'anonymous' }] }), `      <script src="/system.js"></script>
      <script type="systemjs-importmap">
      {
        "test": "map"
      }
      </script>
      <link rel="systemjs-preload" href="/file.js" integrity="sha.." />
      <link rel="systemjs-preload" href="/file.js" crossorigin="anonymous" />
      <h1>hello world</h1>
`);
    }
    {
        const html = `
      <h1>hello world</h1>
    `;
        assertStrictEquals(inject(html, { system: { url: '/system.js' }, preloads: [{ url: '/file.js', integrity: 'sha..' }, { url: '/file.js', crossorigin: 'anonymous' }] }), `<script src="/system.js"></script>

      <link rel="systemjs-preload" href="/file.js" integrity="sha.." />
      <link rel="systemjs-preload" href="/file.js" crossorigin="anonymous" />
      <h1>hello world</h1>
`);
    }
    console.groupEnd();
}
//# sourceMappingURL=map.js.map