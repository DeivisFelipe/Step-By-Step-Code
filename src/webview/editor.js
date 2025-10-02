const vscode = acquireVsCodeApi();
let editor;
let currentContent = `{{CONTENT}}`;
let currentLanguage = `{{LANGUAGE}}`;

// Tentar várias estratégias para carregar o Monaco
function createEditor() {
    const contentElement = document.getElementById('editor');
    
    if (!contentElement) {
        console.error('Elemento editor não encontrado');
        return;
    }

    // Verificar se as variáveis foram substituídas corretamente
    if (currentContent.includes('{{CONTENT}}')) {
        currentContent = '';
        console.warn('Conteúdo não foi substituído, usando string vazia');
    }
    
    if (currentLanguage.includes('{{LANGUAGE}}')) {
        currentLanguage = 'javascript';
        console.warn('Linguagem não foi substituída, usando javascript');
    }

    // Estratégia 1: Tentar usar Monaco direto (se disponível)
    if (typeof monaco !== 'undefined') {
        console.log('Monaco disponível diretamente');
        createMonacoEditor(contentElement);
        return;
    }

    // Estratégia 2: Aguardar um pouco e tentar novamente
    setTimeout(() => {
        if (typeof monaco !== 'undefined') {
            console.log('Monaco disponível após timeout');
            createMonacoEditor(contentElement);
            return;
        }

        // Estratégia 3: Usar fallback se Monaco não estiver disponível
        console.warn('Monaco não disponível, usando fallback');
        createFallbackEditor();
    }, 100);
}

function createMonacoEditor(contentElement) {
    try {
        editor = monaco.editor.create(contentElement, {
            value: currentContent,
            language: currentLanguage,
            theme: 'vs-dark',
            automaticLayout: true,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            fontSize: 14,
            lineHeight: 20,
            wordWrap: 'on',
            renderLineHighlight: 'none',
            hideCursorInOverviewRuler: true,
            overviewRulerBorder: false,
            overviewRulerLanes: 0,
            lineNumbers: 'on',
            lineNumbersMinChars: 3,
            glyphMargin: false,
            folding: false,
            selectOnLineNumbers: true,
            roundedSelection: false,
            readOnly: false,
            cursorStyle: 'line',
            automaticLayout: true
        });

        // Configurar eventos após o editor ser criado
        setupEventListeners();
        
        console.log('Editor Monaco criado com sucesso');
    } catch (error) {
        console.error('Erro ao criar editor Monaco:', error);
        
        // Fallback para textarea simples se Monaco falhar
        createFallbackEditor();
    }
}

function createFallbackEditor() {
    const contentElement = document.getElementById('editor');
    contentElement.innerHTML = `
        <textarea id="fallback-editor" placeholder="Digite seu código aqui...">${currentContent}</textarea>
    `;
    
    // Aplicar estilos ao fallback editor
    const fallbackEditor = document.getElementById('fallback-editor');
    if (fallbackEditor) {
        fallbackEditor.style.cssText = `
            width: 100%;
            height: 100%;
            background: #1e1e1e;
            color: #d4d4d4;
            border: none;
            font-family: 'Consolas', 'Courier New', monospace;
            font-size: 14px;
            line-height: 20px;
            padding: 15px;
            resize: none;
            outline: none;
            tab-size: 4;
            white-space: pre;
            overflow-wrap: normal;
            box-sizing: border-box;
        `;
        
        // Permitir Tab para indentação
        fallbackEditor.addEventListener('keydown', function(e) {
            if (e.key === 'Tab') {
                e.preventDefault();
                const start = this.selectionStart;
                const end = this.selectionEnd;
                
                // Inserir tab
                this.value = this.value.substring(0, start) + '\t' + this.value.substring(end);
                
                // Manter cursor na posição correta
                this.selectionStart = this.selectionEnd = start + 1;
            }
        });
    }
    
    setupEventListeners();
    console.log('Editor fallback criado');
}

function setupEventListeners() {
    // Atalho CTRL+S / CMD+S
    window.addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 's') {
            e.preventDefault();
            sendSave();
        }
    });

    // Troca de linguagem
    const languageSelect = document.getElementById('language');
    if (languageSelect) {
        languageSelect.value = currentLanguage; // Definir valor salvo
        languageSelect.addEventListener('change', (event) => {
            const newLanguage = event.target.value;
            currentLanguage = newLanguage;
            
            if (editor && typeof monaco !== 'undefined') {
                monaco.editor.setModelLanguage(editor.getModel(), newLanguage);
            }
        });
    }

    // Lógica de exclusividade entre opções
    const deletePreviousCheckbox = document.getElementById('delete-previous');
    const keepIndentationCheckbox = document.getElementById('keep-indentation');
    
    if (deletePreviousCheckbox && keepIndentationCheckbox) {
        deletePreviousCheckbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                keepIndentationCheckbox.checked = false;
            }
        });
        
        keepIndentationCheckbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                deletePreviousCheckbox.checked = false;
            }
        });
    }

    // Botão salvar
    const saveButton = document.querySelector('.btn');
    if (saveButton) {
        saveButton.addEventListener('click', sendSave);
    }
}

function sendSave() {
    let content = '';
    
    if (editor) {
        content = editor.getValue();
    } else {
        // Fallback para textarea
        const fallbackEditor = document.getElementById('fallback-editor');
        if (fallbackEditor) {
            content = fallbackEditor.value;
        }
    }

    const deletePrevious = document.getElementById('delete-previous')?.checked || false;
    const keepIndentation = document.getElementById('keep-indentation')?.checked || false;
    const enableAnimation = document.getElementById('enable-animation')?.checked || false;
    const language = document.getElementById('language')?.value || 'javascript';

    vscode.postMessage({
        command: 'save',
        content: content,
        language: language,
        deletePrevious: deletePrevious,
        keepIndentation: keepIndentation,
        enableAnimation: enableAnimation,
    });
}

// Aguardar o DOM estar pronto e tentar criar o editor
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createEditor);
} else {
    createEditor();
}
