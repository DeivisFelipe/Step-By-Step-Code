const vscode = acquireVsCodeApi();
let editor;

require.config({ paths: { 'vs': 'https://unpkg.com/monaco-editor@0.45.0/min/vs' } });
require(['vs/editor/editor.main'], function () {
    editor = monaco.editor.create(document.getElementById('editor'), {
        value: ``,
        language: 'javascript',
        theme: 'vs-dark',
        automaticLayout: true
    });

    // Atalho CTRL+S / CMD+S
    window.addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 's') {
            e.preventDefault();
            sendSave();
        }
    });
});

// Troca de linguagem
document.getElementById('language').addEventListener('change', (event) => {
    const newLanguage = event.target.value;
    if (editor) {
        monaco.editor.setModelLanguage(editor.getModel(), newLanguage);
    }
});

// Botão salvar
document.querySelector('.btn').addEventListener('click', sendSave);

function sendSave() {
    vscode.postMessage({
        command: 'save',
        content: editor ? editor.getValue() : '',
        deletePrevious: document.getElementById('delete-previous').checked,
        keepIndentation: document.getElementById('keep-indentation').checked,
        enableAnimation: document.getElementById('enable-animation').checked,
    });
}