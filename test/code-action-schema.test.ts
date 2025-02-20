/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { SCHEMA_ID, setupLanguageService, setupSchemaIDTextDocument } from './utils/testHelper';
import { ServiceSetup } from './utils/serviceSetup';
import { TextDocumentIdentifier, CodeActionParams, CodeActionContext, TextEdit, Range } from 'vscode-languageserver';
import { expect } from 'chai';
import { SettingsState, TextDocumentTestManager } from '../src/yamlSettings';
import { ValidationHandler } from '../src/languageserver/handlers/validationHandlers';
import { LanguageService } from '../src/languageservice/yamlLanguageService';
import { YamlCodeActions } from '../src/languageservice/services/yamlCodeActions';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { TEST_URI } from './utils/testHelper';

describe('Schema Errors Code Action Tests', () => {
  let languageSettingsSetup: ServiceSetup;
  let validationHandler: ValidationHandler;
  let languageService: LanguageService;
  let yamlSettings: SettingsState;

  before(() => {
    languageSettingsSetup = new ServiceSetup().withValidate();
    const { languageService: langService, validationHandler: valHandler, yamlSettings: settings } = setupLanguageService(
      languageSettingsSetup.languageSettings
    );
    languageService = langService;
    validationHandler = valHandler;
    yamlSettings = settings;
  });

  function parseSetup(content: string, customSchemaID?: string): TextDocument {
    const testTextDocument = setupSchemaIDTextDocument(content, customSchemaID);
    yamlSettings.documents = new TextDocumentTestManager();
    (yamlSettings.documents as TextDocumentTestManager).set(testTextDocument);
    return testTextDocument;
  }

  afterEach(() => {
    languageService.deleteSchema(SCHEMA_ID);
  });

  describe('Convert value code action tests', () => {
    it('Should provide convert to boolean action for false', async () => {
      languageService.addSchema(SCHEMA_ID, {
        type: 'object',
        properties: {
          analytics: {
            type: 'boolean',
          },
        },
      });
      const content = 'analytics: "false"';
      const doc = parseSetup(content);
      const diagnostics = await validationHandler.validateTextDocument(doc);
      const params: CodeActionParams = {
        context: CodeActionContext.create(diagnostics),
        range: undefined,
        textDocument: TextDocumentIdentifier.create(TEST_URI),
      };
      const actions = new YamlCodeActions({});
      const result = actions.getCodeAction(doc, params);
      expect(result.length).to.be.equal(1);
      expect(result[0].title).to.be.equal('Convert to boolean');
      expect(result[0].edit.changes[doc.uri]).to.exist;
      const edit = result[0].edit.changes[doc.uri];
      expect(edit.length).to.be.equal(1);
      expect(edit[0]).deep.equal(TextEdit.replace(Range.create(0, 11, 0, 18), 'false'));
    });

    it('Should provide convert to boolean action for true', async () => {
      languageService.addSchema(SCHEMA_ID, {
        type: 'object',
        properties: {
          analytics: {
            type: 'boolean',
          },
        },
      });
      const content = "analytics: 'true'";
      const doc = parseSetup(content);
      const diagnostics = await validationHandler.validateTextDocument(doc);
      const params: CodeActionParams = {
        context: CodeActionContext.create(diagnostics),
        range: undefined,
        textDocument: TextDocumentIdentifier.create(TEST_URI),
      };
      const actions = new YamlCodeActions({});
      const result = actions.getCodeAction(doc, params);
      expect(result.length).to.be.equal(1);
      expect(result[0].title).to.be.equal('Convert to boolean');
      expect(result[0].edit.changes[doc.uri]).to.exist;
      const edit = result[0].edit.changes[doc.uri];
      expect(edit.length).to.be.equal(1);
      expect(edit[0]).deep.equal(TextEdit.replace(Range.create(0, 11, 0, 17), 'true'));
    });
  });
});
