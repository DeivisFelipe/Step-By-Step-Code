const vscode = acquireVsCodeApi();
let editor;

// O Monaco já existe no VS Code, então não precisamos do require.config nem do unpkg
// Basta usar 'monaco' diretamente quando o Webview carregar

window.addEventListener('load', () => {
    // Cria o editor
    editor = monaco.editor.create(document.getElementById('editor'), {
        value: `{{CONTENT}}`,
        language: '{{LANGUAGE}}',
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

    // Troca de linguagem
    const languageSelect = document.getElementById('language');
    languageSelect.addEventListener('change', (event) => {
        const newLanguage = event.target.value;
        if (editor) {
            monaco.editor.setModelLanguage(editor.getModel(), newLanguage);
        }
    });

    // Botão salvar
    document.querySelector('.btn').addEventListener('click', sendSave);
});

function sendSave() {
    vscode.postMessage({
        command: 'save',
        content: editor ? editor.getValue() : '',
        deletePrevious: document.getElementById('delete-previous').checked,
        keepIndentation: document.getElementById('keep-indentation').checked,
        enableAnimation: document.getElementById('enable-animation').checked,
    });
}
