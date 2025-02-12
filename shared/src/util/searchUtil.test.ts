import { createSyntaxDiagramsCode } from 'chevrotain';
import fs from 'node:fs';
import { inspect } from 'node:util';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import { parseSearchQuery, SearchParser } from './searchUtil.js';

describe('search parser', () => {
  test('simple parse', () => {
    const __dirname = dirname(fileURLToPath(import.meta.url));

    const input = 'genre IN [comedy, horror] OR title ~ "XYZ"';
    const lexerResult = parseSearchQuery(input);
    const parser = new SearchParser();
    parser.input = lexerResult.tokens;
    const serializedGrammar = parser.getSerializedGastProductions();

    // console.log(inspect(lexerResult, false, null));
    const result = parser.searchExpression();
    console.log(inspect(result, false, null));

    // const visitor = new SearchExpressionVisitor();
    // visitor.visit(result);

    const htmlText = createSyntaxDiagramsCode(serializedGrammar, {});

    // Write the HTML file to disk
    const outPath = path.resolve(__dirname, './');
    fs.writeFileSync(outPath + '/generated_diagrams.html', htmlText);
  });
});
