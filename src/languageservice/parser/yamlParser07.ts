/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Copyright (c) Adam Voss. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import {
  Parser,
  Composer,
  Document,
  LineCounter,
  ParseOptions,
  DocumentOptions,
  SchemaOptions,
  visit,
  YAMLMap,
  Node,
  isNode,
  Pair,
} from 'yaml';
import { YAMLDocument, SingleYAMLDocument } from './yaml-documents';
import { getCustomTags } from './custom-tag-provider';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { TextBuffer } from '../utils/textBuffer';

export { YAMLDocument, SingleYAMLDocument };

export type YamlVersion = '1.1' | '1.2';
export interface ParserOptions {
  customTags: string[];
  yamlVersion: YamlVersion;
}
export const defaultOptions: ParserOptions = {
  customTags: [],
  yamlVersion: '1.2',
};

/**
 * `yaml-ast-parser-custom-tags` parses the AST and
 * returns YAML AST nodes, which are then formatted
 * for consumption via the language server.
 */
export function parse(text: string, parserOptions: ParserOptions = defaultOptions, document?: TextDocument): YAMLDocument {
  const options: ParseOptions & DocumentOptions & SchemaOptions = {
    strict: false,
    customTags: getCustomTags(parserOptions.customTags),
    version: parserOptions.yamlVersion,
    keepSourceTokens: true,
  };
  const composer = new Composer(options);
  const lineCounter = new LineCounter();
  let isLastLineEmpty = false;
  if (document) {
    const textBuffer = new TextBuffer(document);
    const position = textBuffer.getPosition(text.length);
    const lineContent = textBuffer.getLineContent(position.line);
    isLastLineEmpty = lineContent.trim().length === 0;
  }

  const parser = isLastLineEmpty ? new Parser() : new Parser(lineCounter.addNewLine);
  const tokens = parser.parse(text);
  const tokensArr = Array.from(tokens);
  const docs = composer.compose(tokensArr, true, text.length);

  // Generate the SingleYAMLDocs from the AST nodes
  const yamlDocs: SingleYAMLDocument[] = Array.from(docs, (doc) =>
    parsedDocToSingleYAMLDocument(doc, lineCounter, parserOptions.customTags)
  );

  // Consolidate the SingleYAMLDocs
  return new YAMLDocument(yamlDocs, tokensArr);
}

function parsedDocToSingleYAMLDocument(parsedDoc: Document, lineCounter: LineCounter, customTags: string[]): SingleYAMLDocument {
  const transformed = transform(parsedDoc, customTags);

  const syd = new SingleYAMLDocument(lineCounter);
  syd.internalDocument = transformed;
  return syd;
}

export function transform(doc: Document, customTags: string[]): Document {
  const tagMap = customTags
    .map((t) => t.split(' '))
    .map((p) => ({ tag: p[0], type: p.length > 1 ? p[1] : 'scalar' }))
    .reduce((p, c) => ({ ...p, [c.tag]: c.type }), {} as Record<string, string>);

  visit(doc, {
    Map: (_, node) => {
      if (!node.tag) {
        return;
      }
      const pair = createPairFrom(node, doc, '$type', node.tag.replace('!app:', ''));
      node.add(pair);
    },
    Scalar: (_, node) => {
      if (!node.tag) {
        return;
      }
      const newNode = doc.createNode({}) as YAMLMap;
      newNode.range = node.range;
      newNode.srcToken = node.srcToken;
      const typePair = createPairFrom(node, doc, '$type', node.tag.replace('!app:', ''));
      newNode.add(typePair);
      if (tagMap[node.tag] === 'scalar') {
        const copied = node.clone();
        copied.tag = undefined;
        const p2 = createPairFrom(node, doc, 'value', copied);
        newNode.add(p2);
      }
      return newNode;
    },
  });

  return doc;
}

function createPairFrom(node: Node, doc: Document, key: string, value: unknown): Pair<Node, Node> {
  const keyNode = doc.createNode(key);
  keyNode.range = node.range;
  keyNode.srcToken = node.srcToken;
  if (!isNode(value)) {
    const valueNode = doc.createNode(value);
    valueNode.range = node.range;
    valueNode.srcToken = node.srcToken;
    return doc.createPair(keyNode, valueNode);
  } else {
    return doc.createPair(keyNode, value);
  }
}
