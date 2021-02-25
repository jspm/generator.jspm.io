export function highlight (code) {
  return code
    .replace(/^(\s*\/\/.*)/gm, '<span class=comment>$1</span>')
    .replace(/&lt;!--/g, '<span class=comment>&lt;!--')
    .replace(/-->/g, '--></span>')
    .replace(/('[^']*')/gm, '<span class=string>$1</span>')
    .replace(/("[^"]*")/gm, '<span class=string>$1</span>')
    .replace(/([^#\d\-a-z\:])(-?\d+)/gm, '$1<span class=number>$2</span>')
    .replace(/([^\.\-]|^)(for|function|new|await|async|throw|return|var|let|const|if|else|true|as|false|this|import|export class|export|from)([^-a-zA-Z=]|$)/gm, '$1<span class=keyword>$2</span>$3');
}

export function copyToClipboard (text) {
  const el = document.createElement('textarea');
  el.value = text;
  document.body.appendChild(el);
  el.select();
  document.execCommand('copy');
  document.body.removeChild(el);
}

export function download (text, filename) {
  const link = document.createElement('a');
  link.download = filename;
  link.href = URL.createObjectURL(new Blob([text]));
  link.click();
}

export function getIdentifier (str) {
  return str.split('/').pop().match(/^\w+/)[0];
}
