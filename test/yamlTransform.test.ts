import { parseDocument, stringify } from 'yaml';
import { transform } from '../src/languageservice/parser/yamlParser07';

describe('Transform', () => {
  it('transform should create a new node for a document tag', () => {
    const doc = parseDocument(`
!app:DataBlock
abc: def
    `);
    const transformed = transform(doc);
    console.log(stringify(transformed));
  });
});
