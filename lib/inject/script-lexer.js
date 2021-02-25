let source, i;
;
;
const scriptSkeleton = new Set(['script', 'link', 'head', 'body', 'html', '!doctype']);
const selfClosing = new Set(['area', 'base', 'br', 'embed', 'hr', 'iframe', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', '!doctype']);
export function parseTags(_source, include = scriptSkeleton) {
    const tags = [];
    source = _source;
    i = 0;
    let curTag = { name: '', start: -1, end: -1, attributes: [], innerStart: -1, innerEnd: -1 };
    while (i < source.length) {
        while (source.charCodeAt(i++) !== 60 /*<*/)
            if (i === source.length)
                return tags;
        const name = readTagName();
        if (name === undefined)
            return tags;
        if (name === '!--') {
            while (source.charCodeAt(i) !== 45 /*-*/ || source.charCodeAt(i + 1) !== 45 /*-*/ || source.charCodeAt(i + 2) !== 62 /*>*/)
                if (++i === source.length)
                    return tags;
            i += 3;
        }
        else if (include.has(name)) {
            tags.push(curTag);
            curTag.name = name;
            curTag.start = i - name.length - (source.charCodeAt(i) === 62 ? 1 : 2);
            let attr;
            while (attr = scanAttr())
                curTag.attributes.push({ name: source.slice(attr.nameStart, attr.nameEnd), value: source.slice(attr.valueStart, attr.valueEnd), ...attr });
            curTag.innerStart = i;
            curTag.innerEnd = curTag.end = curTag.innerStart;
            if (!selfClosing.has(name)) {
                while (true) {
                    while (source.charCodeAt(i++) !== 60 /*<*/)
                        if (i === source.length)
                            return tags;
                    const tag = readTagName();
                    if (tag === undefined) {
                        if (curTag.name !== '') {
                            curTag.end = curTag.innerEnd;
                            tags.push(curTag);
                        }
                        return tags;
                    }
                    if (name !== 'script' || tag === '/' + name) {
                        curTag.innerEnd = i - 1 - tag.length;
                        if (tag[0] !== '/') {
                            i -= tag.length + (source.charCodeAt(i) === 62 ? 1 : 2);
                        }
                        else {
                            while (scanAttr())
                                ;
                            curTag.end = i;
                        }
                        break;
                    }
                }
            }
            curTag = { name: '', start: -1, end: -1, attributes: [], innerStart: -1, innerEnd: -1 };
        }
        else {
            while (scanAttr())
                ;
        }
    }
    return tags;
}
function readTagName() {
    let start = i;
    let ch;
    while (!isWs(ch = source.charCodeAt(i++)) && ch !== 62 /*>*/)
        if (i === source.length)
            return;
    return source.slice(start, ch === 62 ? --i : i - 1);
}
function scanAttr() {
    let ch;
    while (isWsOrSlash(ch = source.charCodeAt(i)))
        if (++i === source.length)
            return;
    if (ch === 62 /*>*/) {
        i++;
        return;
    }
    const nameStart = i;
    while (!isWsOrSlash(ch = source.charCodeAt(i++)) && ch !== 61 /*=*/) {
        if (i === source.length)
            return;
        if (ch === 62 /*>*/)
            return { nameStart, nameEnd: --i, valueStart: -1, valueEnd: -1 };
    }
    const nameEnd = i - 1;
    if (ch !== 61 /*=*/) {
        while (isWs(ch = source.charCodeAt(i)) && ch !== 61 /*=*/) {
            if (++i === source.length)
                return;
            if (ch === 62 /*>*/)
                return;
        }
        if (ch !== 61 /*=*/)
            return { nameStart, nameEnd, valueStart: -1, valueEnd: -1 };
    }
    while (isWs(ch = source.charCodeAt(i++))) {
        if (i === source.length)
            return;
        if (ch === 62 /*>*/)
            return;
    }
    if (ch === 34 /*"*/) {
        const valueStart = i;
        while (source.charCodeAt(i++) !== 34 /*"*/)
            if (i === source.length)
                return;
        return { nameStart, nameEnd, valueStart, valueEnd: i - 1 };
    }
    else if (ch === 39 /*'*/) {
        const valueStart = i;
        while (source.charCodeAt(i++) !== 39 /*'*/)
            if (i === source.length)
                return;
        return { nameStart, nameEnd, valueStart, valueEnd: i - 1 };
    }
    else {
        const valueStart = i - 1;
        i++;
        while (!isWs(ch = source.charCodeAt(i)) && ch !== 62 /*>*/)
            if (++i === source.length)
                return;
        return { nameStart, nameEnd, valueStart, valueEnd: i };
    }
}
function isWsOrSlash(ch) {
    return ch === 32 || ch < 14 && ch > 8 || ch === 47;
}
function isWs(ch) {
    return ch === 32 || ch < 14 && ch > 8;
}
// @ts-ignore
function logScripts(source, scripts) {
    for (const script of scripts) {
        for (const { nameStart, nameEnd, valueStart, valueEnd } of script.attributes) {
            console.log('Name: ' + source.slice(nameStart, nameEnd));
            if (valueStart !== -1)
                console.log('Value: ' + source.slice(valueStart, valueEnd));
        }
        console.log('"' + source.slice(script.innerStart, script.innerEnd) + '"');
        console.log('"' + source.slice(script.start, script.end) + '"');
    }
}
// @ts-ignore
if (import.meta.main) {
    // @ts-ignore
    const { assertStrictEquals } = await import('https://deno.land/std/testing/asserts.ts');
    console.group('Simple script');
    {
        const source = `
      <script type="module">test</script>
      <script src="hi" jspm-preload></script>
      <link rel="modulepreload" />
    `;
        const scripts = parseTags(source);
        assertStrictEquals(scripts.length, 3);
        assertStrictEquals(scripts[0].attributes.length, 1);
        const attr = scripts[0].attributes[0];
        assertStrictEquals(source.slice(attr.nameStart, attr.nameEnd), "type");
        assertStrictEquals(source.slice(attr.valueStart, attr.valueEnd), "module");
        assertStrictEquals(scripts[0].innerStart, 29);
        assertStrictEquals(scripts[0].innerEnd, 33);
        assertStrictEquals(scripts[0].start, 7);
        assertStrictEquals(scripts[0].end, 42);
        assertStrictEquals(scripts[1].start, 49);
        assertStrictEquals(scripts[1].end, 88);
        assertStrictEquals(scripts[1].attributes.length, 2);
        assertStrictEquals(scripts[2].attributes.length, 1);
        const attr2 = scripts[2].attributes[0];
        assertStrictEquals(source.slice(attr2.nameStart, attr2.nameEnd), "rel");
        assertStrictEquals(source.slice(attr2.valueStart, attr2.valueEnd), "modulepreload");
    }
    console.groupEnd();
    console.group('Edge cases');
    {
        const source = `
    <!-- <script>
      <!-- /* </script> */ ->
      console.log('hmm');
    </script
    
    <script>
      console.log('hi');
    </script>
    
    
    -->
    
    <script ta"    ==='s'\\>
      console.log('test');
    </script>
    
    <script <!-- <p type="module">
      export var p = 5;
      console.log('hi');
    </script type="test"
    >
    
    

    `;
        const scripts = parseTags(source);
        assertStrictEquals(scripts.length, 2);
        assertStrictEquals(scripts[0].attributes.length, 1);
        let attr = scripts[0].attributes[0];
        assertStrictEquals(source.slice(attr.nameStart, attr.nameEnd), 'ta"');
        assertStrictEquals(source.slice(attr.valueStart, attr.valueEnd), '===\'s\'\\');
        assertStrictEquals(scripts[0].innerStart, 195);
        assertStrictEquals(scripts[0].innerEnd, 227);
        assertStrictEquals(scripts[0].start, 172);
        assertStrictEquals(scripts[0].end, 236);
        assertStrictEquals(scripts[1].attributes.length, 3);
        attr = scripts[1].attributes[0];
        assertStrictEquals(source.slice(attr.nameStart, attr.nameEnd), '<!--');
        assertStrictEquals(attr.valueStart, -1);
        assertStrictEquals(attr.valueEnd, -1);
        attr = scripts[1].attributes[1];
        assertStrictEquals(source.slice(attr.nameStart, attr.nameEnd), '<p');
        assertStrictEquals(attr.valueStart, -1);
        assertStrictEquals(attr.valueEnd, -1);
        attr = scripts[1].attributes[2];
        assertStrictEquals(source.slice(attr.nameStart, attr.nameEnd), 'type');
        assertStrictEquals(source.slice(attr.valueStart, attr.valueEnd), 'module');
        assertStrictEquals(scripts[1].innerStart, 276);
        assertStrictEquals(scripts[1].innerEnd, 331);
        assertStrictEquals(scripts[1].start, 246);
        assertStrictEquals(scripts[1].end, 356);
    }
    console.groupEnd();
    console.group('unclosed tags');
    {
        const scripts = parseTags(`
      <head>
        <script type="importmap"></script>
      <body>
    `);
        assertStrictEquals(scripts.length, 3);
    }
    console.groupEnd();
}
//# sourceMappingURL=script-lexer.js.map