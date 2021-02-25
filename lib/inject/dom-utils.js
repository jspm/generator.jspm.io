// @ts-ignore
import '../deps.d.ts';
import MagicString from 'magic-string';
import { detectStyle } from '../common/source-style.js';
import { parseTags } from './script-lexer.js';
import { stringifyStyled } from '../common/json.js';
const ws = /\s+/;
function detectSpace(source, index) {
    const nl = source.lastIndexOf('\n', index);
    if (nl !== -1) {
        const detectedSpace = source.slice(nl, index);
        if (detectedSpace.match(ws))
            return detectedSpace;
    }
    const style = detectStyle(source);
    return style.newline + style.indent;
}
export function removeElement(source, el) {
    let spaceLen = detectSpace(source.original, el.start).length;
    if (spaceLen > el.start)
        spaceLen = el.start;
    source.remove(el.start - spaceLen, el.end);
}
export function insertAfter(source, el, injection) {
    const detectedSpace = detectSpace(source.original, el.start);
    source.appendRight(el.end, detectedSpace + injection);
}
export function insertBefore(source, el, injection) {
    const detectedSpace = detectSpace(source.original, el.start);
    source.prependLeft(el.start, injection + detectedSpace);
}
export function append(source, el, injection) {
    const style = detectStyle(source.original);
    const detectedSpace = detectSpace(source.original, el.start);
    source.appendLeft(el.end, detectedSpace + style.tab + injection);
}
export function setInnerWithIndentation(source, el, injection) {
    const style = detectStyle(source.original);
    const detectedSpace = detectSpace(source.original, el.start);
    let toInject;
    if (typeof injection === 'string') {
        toInject = style.newline + injection.split('\n').map(line => detectedSpace.slice(1) + line).join(style.newline) + style.newline + detectedSpace.slice(1);
    }
    else {
        if (detectedSpace.length - 1 > style.indent.length)
            style.indent = detectedSpace.slice(1);
        style.trailingNewline = style.newline;
        toInject = style.newline + stringifyStyled(injection, style) + style.indent;
    }
    if (el.innerStart === el.innerEnd)
        source.appendLeft(el.innerStart, toInject);
    else
        source.overwrite(el.innerStart, el.innerEnd, toInject);
}
export function getOrCreateTag(source, els, detect, injection) {
    for (const el of els) {
        if (detect(el))
            return { source, els, el };
    }
    if (injection === null)
        throw new Error('Internal Error: Unexpected injection');
    // end of head
    for (const el of els) {
        if (el.name === 'head') {
            append(source, el, injection);
            const output = source.toString();
            return getOrCreateTag(new MagicString(output), parseTags(output), detect, null);
        }
    }
    // top of body
    for (const el of els) {
        if (el.name === 'body') {
            insertBefore(source, el, injection);
            const output = source.toString();
            return getOrCreateTag(new MagicString(output), parseTags(output), detect, null);
        }
    }
    // after html
    for (const el of els) {
        if (el.name === 'html') {
            append(source, el, injection);
            const output = source.toString();
            return getOrCreateTag(new MagicString(output), parseTags(output), detect, null);
        }
    }
    // after !doctype
    for (const el of els) {
        if (el.name === '!doctype') {
            insertAfter(source, el, injection);
            const output = source.toString();
            return getOrCreateTag(new MagicString(output), parseTags(output), detect, null);
        }
    }
    // top of HTML, whatever
    if (els.length) {
        insertBefore(source, els[0], injection);
        const output = source.toString();
        return getOrCreateTag(new MagicString(output), parseTags(output), detect, null);
    }
    const style = detectStyle(source.original);
    const output = style.indent + injection + source.toString();
    return getOrCreateTag(new MagicString(output), parseTags(output), detect, null);
}
// @ts-ignore
if (import.meta.main) {
    // @ts-ignore
    const { assertStrictEquals } = await import('https://deno.land/std/testing/asserts.ts');
    console.group('Simple removal');
    {
        const source = `
      <script type="module">test</script>
      <script src="hi" jspm-preload></script>
      <link rel="modulepreload" />
    `;
        const string = new MagicString(source);
        const scripts = parseTags(source);
        removeElement(string, scripts[2]);
        assertStrictEquals(string.toString(), `
      <script type="module">test</script>
      <script src="hi" jspm-preload></script>
    `);
    }
    {
        const source = `
      <script type="module">test</script>
      <script src="hi" jspm-preload></script>
      <link rel="modulepreload" />
    `;
        const string = new MagicString(source);
        const scripts = parseTags(source);
        removeElement(string, scripts[1]);
        assertStrictEquals(string.toString(), `
      <script type="module">test</script>
      <link rel="modulepreload" />
    `);
    }
    {
        const source = `
      <script type="module">test</script>
      <script type="importmap">
      {
        "imports": { "stuff": "..." }
      }
        </script>
      <link rel="modulepreload" />
    `;
        const string = new MagicString(source);
        const scripts = parseTags(source);
        removeElement(string, scripts[1]);
        assertStrictEquals(string.toString(), `
      <script type="module">test</script>
      <link rel="modulepreload" />
    `);
    }
    console.groupEnd();
    console.group('Modification');
    {
        const source = `
      <script type="module">test</script>
      <script type="importmap">
      {
        "imports": { "stuff": "..." }
      }
        </script>
      <link rel="modulepreload" />
    `;
        const string = new MagicString(source);
        const scripts = parseTags(source);
        setInnerWithIndentation(string, scripts[1], JSON.stringify({ hello: 'world' }, null, 2));
        assertStrictEquals(string.toString(), `
      <script type="module">test</script>
      <script type="importmap">
      {
        "hello": "world"
      }
      </script>
      <link rel="modulepreload" />
    `);
    }
    {
        const source = `
      <script type="module">
          test
      </script>
      <script type="importmap">
          {
              "imports": { "stuff": "..." }
          }
      </script>
      <link rel="modulepreload" />
    `;
        const string = new MagicString(source);
        const scripts = parseTags(source);
        setInnerWithIndentation(string, scripts[1], { hello: 'world' });
        assertStrictEquals(string.toString(), `
      <script type="module">
          test
      </script>
      <script type="importmap">
      {
          "hello": "world"
      }
      </script>
      <link rel="modulepreload" />
    `);
    }
    console.groupEnd();
    console.group('Insert After');
    {
        const source = `
      <script type="module">test</script>
      <script type="importmap">
      {
        "imports": { "stuff": "..." }
      }
        </script>
      <link rel="modulepreload" />
    `;
        const string = new MagicString(source);
        const scripts = parseTags(source);
        insertAfter(string, scripts[1], '<link rel="modulepreload">');
        assertStrictEquals(string.toString(), `
      <script type="module">test</script>
      <script type="importmap">
      {
        "imports": { "stuff": "..." }
      }
        </script>
      <link rel="modulepreload">
      <link rel="modulepreload" />
    `);
    }
    {
        const source = `
      <script type="module">test</script>
      <script type="importmap">
      {
        "imports": { "stuff": "..." }
      }
        </script>
      <after>
    `;
        const string = new MagicString(source);
        const scripts = parseTags(source);
        insertAfter(string, scripts[1], '<link rel="modulepreload">');
        assertStrictEquals(string.toString(), `
      <script type="module">test</script>
      <script type="importmap">
      {
        "imports": { "stuff": "..." }
      }
        </script>
      <link rel="modulepreload">
      <after>
    `);
    }
    {
        const source = `<script type="importmap"></script>`;
        const string = new MagicString(source);
        const scripts = parseTags(source);
        insertAfter(string, scripts[0], '<link rel="modulepreload">');
        insertAfter(string, scripts[0], '<link rel="modulepreload">');
        assertStrictEquals(string.toString(), `<script type="importmap"></script>
<link rel="modulepreload">
<link rel="modulepreload">`);
    }
    console.groupEnd();
    console.group('Append');
    {
        const source = `
      <head>
      <body>
    `;
        const string = new MagicString(source);
        const scripts = parseTags(source);
        append(string, scripts[0], '<link rel="modulepreload">');
        assertStrictEquals(string.toString(), `
      <head>
        <link rel="modulepreload">
      <body>
    `);
    }
    console.groupEnd();
    console.group('Insert Before');
    {
        const source = `
      <script type="module">test</script>
      <script type="importmap">
      {
        "imports": { "stuff": "..." }
      }
        </script>
      <link rel="modulepreload" />
    `;
        const string = new MagicString(source);
        const scripts = parseTags(source);
        insertBefore(string, scripts[1], '<link rel="modulepreload">');
        assertStrictEquals(string.toString(), `
      <script type="module">test</script>
      <link rel="modulepreload">
      <script type="importmap">
      {
        "imports": { "stuff": "..." }
      }
        </script>
      <link rel="modulepreload" />
    `);
    }
    console.groupEnd();
    console.group('GetOrCreateImportMap');
    {
        const source = `
      <head>
      <body>
    `;
        const string = new MagicString(source);
        const scripts = parseTags(source);
        {
            const { source, els, el } = getOrCreateTag(string, scripts, el => el.name === 'script' && el.attributes.some(attr => attr.name === 'type' && attr.value === 'importmap'), '<script type="importmap"></script>');
            assertStrictEquals(source.toString(), `
      <head>
        <script type="importmap"></script>
      <body>
    `);
            assertStrictEquals(el.start, 22);
            const { el: innerMap } = getOrCreateTag(source, els, el => el.name === 'script' && el.attributes.some(attr => attr.name === 'type' && attr.value === 'importmap'), '<script type="importmap"></script>');
            assertStrictEquals(el, innerMap);
        }
    }
    console.groupEnd();
}
//# sourceMappingURL=dom-utils.js.map