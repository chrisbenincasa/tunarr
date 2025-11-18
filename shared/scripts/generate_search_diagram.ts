import { createSyntaxDiagramsCode } from 'chevrotain';
import fs from 'node:fs';
import path, { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SearchParser } from '../src/util/searchUtil.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const parser = new SearchParser();
const serializedGrammar = parser.getSerializedGastProductions();
const htmlText = createSyntaxDiagramsCode(serializedGrammar, {});
// Write the HTML file to disk
const outPath = path.resolve(__dirname, './');
fs.writeFileSync(outPath + '/generated_diagrams.html', htmlText);
