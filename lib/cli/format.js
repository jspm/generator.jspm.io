import chalk from 'chalk';
export function indent(source, indent) {
    return source.split('\n').map(line => indent + line).join('\n').slice(indent.length);
}
export function printFrame(source, line = 1, _col = 1, _pointer = false, before = Infinity, after = Infinity) {
    const lines = source.split('\n');
    const lineRange = lines.slice(Math.min(line - 1 - before, 0), Math.max(line + after, lines.length));
    let gutterWidth = lineRange.length.toString().length;
    return lineRange.map((line, index) => (index + 1).toString().padStart(gutterWidth, ' ') + '|' + '  ' + line).join('\n');
}
const nodes = {
    end: chalk.bold('└'),
    middle: chalk.bold('├'),
    skip: chalk.bold('│'),
    item: chalk.bold('╴')
};
function isItemLine(line) {
    return !line.startsWith(nodes.end) && !line.startsWith(nodes.middle) && !line.startsWith(nodes.skip) && line[0] !== ' ';
}
export function indentGraph(lines) {
    let lastItemLine = -1;
    for (let i = 0; i < lines.length; i++) {
        if (isItemLine(lines[i])) {
            lastItemLine = i;
        }
    }
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (isItemLine(line))
            lines[i] = (i >= lastItemLine ? nodes.end : nodes.middle) + nodes.item + line;
        else
            lines[i] = (i >= lastItemLine ? ' ' : nodes.skip) + ' ' + line;
    }
    return lines;
}
//# sourceMappingURL=format.js.map