import * as vscode from 'vscode';
import StepItem from './StepItem';

export default class StepProvider implements vscode.TreeDataProvider<StepItem> {
    private readonly _onDidChangeTreeData: vscode.EventEmitter<StepItem | undefined | null> = new vscode.EventEmitter<StepItem | undefined | null>();
    readonly onDidChangeTreeData: vscode.Event<StepItem | undefined | null> = this._onDidChangeTreeData.event;

    private readonly steps: StepItem[] = [];
    private currentIndex = -1;

    refresh(): void {
        this._onDidChangeTreeData.fire(null);
    }

    getTreeItem(element: StepItem): vscode.TreeItem {
        return element;
    }

    getChildren(): Thenable<StepItem[]> {
        return Promise.resolve(
            this.steps.map((step: StepItem) => {
                const prefix = step.index === this.currentIndex ? '➡️ ' : '';
                const sufix = step.content ? '' : ' (vazio)';
                const item = new StepItem(prefix + step.label + sufix, step.title, step.content, step.index);

                item.command = {
                    title: 'Executar passo',
                    command: 'stepByStep.executeStep',
                    arguments: [item],
                };

                return item;
            })
        );
    }

    async addStep(): Promise<void> {
        const title = await vscode.window.showInputBox({ prompt: 'Digite o título do novo passo:' });

        if (title) {
            const step = new StepItem(title, title, '', this.steps.length);
            this.steps.push(step);
            this.refresh();
        }
    }

    nextStep(): void {
        if (this.currentIndex < this.steps.length - 1) {
            this.currentIndex++;
            this.insertStepContent();
            this.refresh();
        }
    }

    prevStep(): void {
        if (this.currentIndex > 0) {
            this.currentIndex--;
            this.insertStepContent();
            this.refresh();
        }
    }

    private insertStepContent(): void {
        const editor = vscode.window.activeTextEditor;

        if (!editor) {
            vscode.window.showErrorMessage('Nenhum editor de texto ativo para inserir o conteúdo do passo.');
            return;
        }

        if (this.currentIndex < 0 || this.currentIndex >= this.steps.length) {
            vscode.window.showErrorMessage('Nenhum passo selecionado.');
            return;
        }

        const step = this.steps[this.currentIndex];
        if (!step) return;

        if (!step.content) {
            vscode.window.showErrorMessage('O passo selecionado não possui conteúdo para inserir.');
            return;
        }

        const position = editor.selection.active;

        editor.edit(editBuilder => {
            editBuilder.insert(position, step.content + '\n');
        });
    }

    resetSteps(): void {
        this.currentIndex = -1;
        this.refresh();
    }

    deleteStep(item: StepItem): void {
        this.steps.splice(item.index, 1);
        this.steps.forEach((step, idx) => step.index = idx);
        if (this.currentIndex >= this.steps.length) {
            this.currentIndex = this.steps.length - 1;
        }
        this.refresh();
    }

    renameStep(item: StepItem): void {
        vscode.window.showInputBox({ prompt: 'Novo título do passo:', value: item.title }).then(newTitle => {
            if (newTitle) {
                const index = item.index;
                const step = this.steps[index];
                if (step) {
                    step.label = newTitle;
                    step.title = newTitle;
                    this.refresh();
                }
            }
        });
    }

    async editStep(item: StepItem): Promise<void> {
        const panel = vscode.window.createWebviewPanel(
            'stepEditor',
            item.title,
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        panel.webview.html = this.getWebviewContent(item);

        panel.webview.onDidReceiveMessage(
            message => {
                if (message.command === 'save') {
                    const step = this.steps[item.index];
                    if (step) {
                        step.content = message.content;
                        this.refresh();
                        vscode.window.showInformationMessage(`Conteúdo do passo "${step.title}" salvo.`);
                    }
                }
            },
            undefined,
            []
        );
    }

    private getWebviewContent(item: StepItem): string {
        const escaped = item.content.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return `
			<!DOCTYPE html>
				<html lang="en">
				<head>
				<meta charset="UTF-8">
				<title>${item.title}</title>
				<style>
				html, body {
					height: 100%;
					margin: 0;
					padding: 0 20px;
					font-family: sans-serif;
					background: #1e1e1e;
					color: #fff;
				}
				h3 span { font-weight: normal; }
				#editor { width: 100%; height: 500px; border: 1px solid #444; }
				label { margin-right: 10px; }
				select, input[type="number"] { padding: 5px; margin-right: 15px; }
				.switch-label { display: flex; align-items: center; margin: 5px 0; cursor: pointer; }
				.switch-label input { margin-right: 10px; }
				#controls { margin-top: 10px; }
				button { padding: 8px 16px; margin-top: 15px; cursor: pointer; background-color: #007acc; color: white; border: none; border-radius: 4px; }
				button:hover { background-color: #005a9e; }
				#animation-time { display: none; width: 60px; }
				</style>
				<script src="https://unpkg.com/monaco-editor@0.45.0/min/vs/loader.js"></script>
				</head>
				<body>

				<h3><span>Passo:</span> <span style="font-size: 1.5em">${item.title}</span></h3>

				<div id="controls">
				<label for="language">Linguagem:</label>
				<select id="language">
					<option value="javascript">JavaScript</option>
					<option value="typescript">TypeScript</option>
					<option value="python">Python</option>
					<option value="java">Java</option>
					<option value="csharp">C#</option>
				</select>

				<label class="switch-label">
					<input type="checkbox" id="delete-previous"> Deletar conteúdo anterior
				</label>
				<label class="switch-label">
					<input type="checkbox" id="keep-indentation"> Manter indentação
				</label>
				<label class="switch-label">
					<input type="checkbox" id="enable-animation"> Animação de escrita
					<input type="number" id="animation-time" min="10" value="50"> ms
				</label>
				</div>

				<div id="editor"></div>

				<button id="saveBtn">💾 Salvar</button>

				<script>
				const vscode = acquireVsCodeApi();
				let editor;

				require.config({ paths: { 'vs': 'https://unpkg.com/monaco-editor@0.45.0/min/vs' } });
				require(['vs/editor/editor.main'], function () {
				editor = monaco.editor.create(document.getElementById('editor'), {
					value: \`${escaped}\`,
					language: '${item.language}',
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

				// Mostrar input de tempo apenas se animação estiver ativa
				document.getElementById('enable-animation').addEventListener('change', (e) => {
				document.getElementById('animation-time').style.display = e.target.checked ? 'inline-block' : 'none';
				});

				// Botão salvar
				document.getElementById('saveBtn').addEventListener('click', sendSave);

				function sendSave() {
				vscode.postMessage({
					command: 'save',
					content: editor ? editor.getValue() : '',
					deletePrevious: document.getElementById('delete-previous').checked,
					keepIndentation: document.getElementById('keep-indentation').checked,
					enableAnimation: document.getElementById('enable-animation').checked,
					animationTime: parseInt(document.getElementById('animation-time').value || 50)
				});
				}
				</script>

				</body>
				</html>
		`;
    }

    executeStep(item: StepItem): void {
        this.currentIndex = item.index;
        this.insertStepContent();
        this.refresh();
    }
}