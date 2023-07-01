/*
import { CodeMirrorEditor } from '@jupyterlab/codemirror';
import type { MarkerRange, TextMarker, TextMarkerOptions } from 'codemirror';
import type * as lsProtocol from 'vscode-languageserver-protocol';

import { CodeDiagnostics as LSPDiagnosticsSettings } from '../../_diagnostics';
import {
  FileEditorFeatureTestEnvironment,
  MockSettings,
  NotebookFeatureTestEnvironment,
  code_cell,
  set_notebook_content,
  showAllCells
} from '../../editor_integration/testutils';
import { DiagnosticSeverity } from '../../lsp';
import { is_equal } from '../../positioning';
import { foreignCodeExtractors } from '../../transclusions/ipython/extractors';

import { DiagnosticsCM, diagnostics_panel } from './diagnostics';
import { message_without_code } from './listing';

const SETTING_DEFAULTS: LSPDiagnosticsSettings = {
  ignoreCodes: [],
  ignoreMessagesPatterns: [],
  ignoreSeverities: [],
  defaultSeverity: 'Warning'
};

describe('Diagnostics', () => {
  let feature: DiagnosticsCM;
  let defaultSettings = new MockSettings<LSPDiagnosticsSettings>({
    ...SETTING_DEFAULTS
  });

  describe('FileEditor integration', () => {
    let env: FileEditorFeatureTestEnvironment;

    beforeEach(() => {
      env = new FileEditorFeatureTestEnvironment();
      feature = env.init_integration({
        constructor: DiagnosticsCM,
        id: 'Diagnostics',
        settings: defaultSettings
      });
    });
    afterEach(() => {
      env.dispose_feature(feature);
      env.dispose();
    });

    it('calls parent register()', () => {
      feature.register();
      expect(feature.is_registered).toBe(true);
    });

    const diagnostics: lsProtocol.Diagnostic[] = [
      {
        range: {
          start: { line: 0, character: 7 },
          end: { line: 0, character: 9 }
        },
        message: 'Undefined symbol "aa"',
        code: 'E001',
        severity: DiagnosticSeverity['Error']
      },
      {
        range: {
          start: { line: 1, character: 3 },
          end: { line: 1, character: 4 }
        },
        message: 'Trimming whitespace',
        code: 'W001',
        severity: DiagnosticSeverity['Warning']
      }
    ];

    const text = 'res = aa + 1\nres ';

    it('renders inspections', async () => {
      env.ceEditor.model.value.text = text;
      await env.adapter.update_documents();

      let markers: TextMarker[];

      markers = env.ceEditor.editor.getDoc().getAllMarks();
      expect(markers.length).toBe(0);

      feature.handleDiagnostic(null as any, {
        uri: env.document_options.path,
        diagnostics: diagnostics
      });

      let marks = env.ceEditor.editor.getDoc().getAllMarks();
      expect(marks.length).toBe(2);
    });

    it('filters out inspections by code', async () => {
      feature = env.init_integration({
        constructor: DiagnosticsCM,
        id: 'Diagnostics',
        settings: new MockSettings({
          ...SETTING_DEFAULTS,
          ignoreCodes: ['W001']
        })
      });
      env.ceEditor.model.value.text = text;
      await env.adapter.update_documents();

      feature.handleDiagnostic(null as any, {
        uri: env.document_options.path,
        diagnostics: diagnostics
      });

      let markers = env.ceEditor.editor.getDoc().getAllMarks();
      expect(markers.length).toBe(1);
      expect((markers[0] as TextMarkerOptions).title).toBe(
        'Undefined symbol "aa"'
      );
    });

    it('filters out inspections by severity', async () => {
      feature = env.init_integration({
        constructor: DiagnosticsCM,
        id: 'Diagnostics',
        settings: new MockSettings({
          ...SETTING_DEFAULTS,
          ignoreSeverities: ['Warning']
        })
      });
      env.ceEditor.model.value.text = text;
      await env.adapter.update_documents();

      feature.handleDiagnostic(null as any, {
        uri: env.document_options.path,
        diagnostics: diagnostics
      });

      let markers = env.ceEditor.editor.getDoc().getAllMarks();
      expect(markers.length).toBe(1);
      expect((markers[0] as TextMarkerOptions).title).toBe(
        'Undefined symbol "aa"'
      );
    });

    it('filters out inspections by message text', async () => {
      feature = env.init_integration({
        constructor: DiagnosticsCM,
        id: 'Diagnostics',
        settings: new MockSettings({
          ...SETTING_DEFAULTS,
          ignoreMessagesPatterns: ['Undefined symbol "\\w+"']
        })
      });
      env.ceEditor.model.value.text = text;
      await env.adapter.update_documents();

      feature.handleDiagnostic(null as any, {
        uri: env.document_options.path,
        diagnostics: diagnostics
      });

      let markers = env.ceEditor.editor.getDoc().getAllMarks();
      expect(markers.length).toBe(1);
      expect((markers[0] as TextMarkerOptions).title).toBe(
        'Trimming whitespace'
      );
    });
  });

  describe('Notebook integration', () => {
    let env: NotebookFeatureTestEnvironment;

    beforeEach(() => {
      env = new NotebookFeatureTestEnvironment({
        foreignCodeExtractors: {},
        foreignCodeExtractors
      });
      feature = env.init_integration({
        constructor: DiagnosticsCM,
        id: 'Diagnostics',
        settings: defaultSettings
      });
    });
    afterEach(() => {
      env.dispose();
      env.dispose_feature(feature);
    });

    it('renders inspections across cells', async () => {
      set_notebook_content(env.notebook, [
        code_cell(['x =1\n', 'test']),
        code_cell(['    '])
      ]);
      showAllCells(env.notebook);
      await env.adapter.update_documents();

      let document = env.virtual_editor.virtualDocument;
      let uri = env.virtual_editor.virtualDocument.uri;

      feature.handleDiagnostic(null as any, {
        uri: uri,
        diagnostics: [
          {
            source: 'pyflakes',
            range: {
              start: { line: 1, character: 0 },
              end: { line: 1, character: 5 }
            },
            message: "undefined name 'test'",
            severity: 1
          },
          {
            source: 'pycodestyle',
            range: {
              start: { line: 0, character: 3 },
              end: { line: 0, character: 5 }
            },
            message: 'E225 missing whitespace around operator',
            code: 'E225',
            severity: 2
          },
          {
            source: 'pycodestyle',
            range: {
              start: { line: 4, character: 0 },
              end: { line: 4, character: 5 }
            },
            message: 'W391 blank line at end of file',
            code: 'W391',
            severity: 2
          },
          {
            source: 'pycodestyle',
            range: {
              start: { line: 4, character: 0 },
              end: { line: 4, character: 5 }
            },
            message: 'W293 blank line contains whitespace',
            code: 'W293',
            severity: 2
          },
          {
            source: 'mypy',
            range: {
              start: { line: 1, character: 0 },
              end: { line: 1, character: 4 }
            },
            message: "Name 'test' is not defined",
            severity: 1
          }
        ]
      });

      let cm_editors = env.adapter.editors.map(
        editor => (editor as CodeMirrorEditor).editor
      );
      let marks_cell_1 = cm_editors[0].getDoc().getAllMarks();
      // test from mypy, test from pyflakes, whitespace around operator from pycodestyle
      expect(marks_cell_1.length).toBe(3);

      // W391 and W293 should get merged into a single diagnostic (same range)
      let marks_cell_2 = cm_editors[1].getDoc().getAllMarks();
      expect(marks_cell_2.length).toBe(1);

      let mark_cell_2 = marks_cell_2[0];
      let merged_mark_title = (mark_cell_2 as any).title;
      expect(merged_mark_title).to.contain('W391');
      expect(merged_mark_title).to.contain('W293');
      // should be separated by new line
      expect(merged_mark_title).to.contain('\n');

      expect(feature.diagnostics_db.size).toBe(1);
      expect(feature.diagnostics_db.get(document)!.length).toBe(5);

      feature.switchDiagnosticsPanelSource();
      diagnostics_panel.widget.content.update();
      // the panel should contain all 5 diagnostics
      let db = diagnostics_panel.content.model.diagnostics!;
      expect(db.size).toBe(1);
      expect(db.get(document)!.length).toBe(5);
    });

    it('Works in foreign documents', async () => {
      set_notebook_content(env.notebook, [
        code_cell(['valid = 0\n', 'code = 1', '# here']),
        code_cell(['%%python\n', 'y = 1\n', 'x'])
      ]);
      showAllCells(env.notebook);
      await env.adapter.update_documents();

      let document = env.virtual_editor.virtualDocument;
      expect(document.foreignDocuments.size).to.be.equal(1);
      let foreignDocument = document.foreignDocuments.values().next().value;

      let foreign_feature: DiagnosticsCM = env.init_integration({
        constructor: DiagnosticsCM,
        id: 'Diagnostics',
        document: foreignDocument,
        settings: defaultSettings
      });

      let response = {
        uri: foreignDocument.uri,
        diagnostics: [
          {
            source: 'pyflakes',
            range: {
              start: { line: 1, character: 0 },
              end: { line: 1, character: 2 }
            },
            message: "undefined name 'x'",
            severity: 1
          }
        ]
      } as lsProtocol.PublishDiagnosticsParams;

      // test guards against wrongly propagated responses:
      feature.handleDiagnostic(null as any, response);
      let cm_editors = env.adapter.editors.map(
        ceEditor => (ceEditor as CodeMirrorEditor).editor
      );

      let marks_cell_1 = cm_editors[0].getDoc().getAllMarks();
      let marks_cell_2 = cm_editors[1].getDoc().getAllMarks();

      expect(marks_cell_1.length).toBe(0);
      expect(marks_cell_2.length).toBe(0);

      // correct propagation
      foreign_feature.handleDiagnostic(null as any, response);

      marks_cell_1 = cm_editors[0].getDoc().getAllMarks();
      marks_cell_2 = cm_editors[1].getDoc().getAllMarks();

      expect(marks_cell_1.length).toBe(0);
      expect(marks_cell_2.length).toBe(1);

      let mark = marks_cell_2[0] as TextMarker<MarkerRange>;

      let mark_position = mark.find()!;

      // second line (0th and 1st virtual lines) + 1 line for '%%python\n' => line: 2
      expect(is_equal(mark_position.from, { line: 2, ch: 0 })).to.be.true;
      expect(is_equal(mark_position.to, { line: 2, ch: 1 })).to.be.true;

      // the silenced diagnostic for the %%python magic should be ignored
      feature.handleDiagnostic(null as any, {
        uri: document.uri,
        diagnostics: [
          {
            source: 'pyflakes',
            range: {
              start: { line: 5, character: 0 },
              end: { line: 5, character: 52 }
            },
            message: "undefined name 'get_ipython'",
            severity: 1
          }
        ]
      });

      expect(marks_cell_1.length).toBe(0);
    });
  });
});

describe('message_without_code', () => {
  it('Removes redundant code', () => {
    let message = message_without_code({
      source: 'pycodestyle',
      range: {
        start: { line: 4, character: 0 },
        end: { line: 4, character: 5 }
      },
      message: 'W293 blank line contains whitespace',
      code: 'W293',
      severity: 2
    });
    expect(message).to.be.equal('blank line contains whitespace');
  });

  it('Keeps messages without code intact', () => {
    let message = message_without_code({
      source: 'pyflakes',
      range: {
        start: { line: 1, character: 0 },
        end: { line: 1, character: 2 }
      },
      // a message starting from "undefined" is particularly tricky as
      // a lazy implementation can have a coercion of undefined "code"
      // to a string "undefined" which would wrongly chop off "undefined" from message
      message: "undefined name 'x'",
      severity: 1
    });
    expect(message).to.be.equal("undefined name 'x'");
  });
});
*/