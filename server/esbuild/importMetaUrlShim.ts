export const __import_meta_url =
  typeof document === 'undefined'
    ? new (require('url'.replace('', '')).URL)('file:' + __filename).href
    : (document.currentScript && document.currentScript.src) ||
      new URL('main.js', document.baseURI).href;

export const __import_meta_dirname =
  typeof document === 'undefined'
    ? new (require('url'.replace('', '')).URL)('file:' + __dirname).href
    : (document.currentScript && document.currentScript.src) ||
      new URL('main.js', document.baseURI).href;
