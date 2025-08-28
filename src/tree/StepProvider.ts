import * as fs from 'fs';
import * as path from 'path';
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

        panel.webview.html = this.getWebviewContent(item, panel);

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

    private getWebviewContent(item: StepItem, panel: vscode.WebviewPanel): string {
        const escaped = item.content.replace(/</g, '&lt;').replace(/>/g, '&gt;');

        // Ler o HTML
        const htmlPath = path.join(__dirname, '../webview/editor.html');
        let html = fs.readFileSync(htmlPath, 'utf8');

        // Caminhos dos arquivos CSS e JS
        const cssPath = vscode.Uri.file(path.join(__dirname, '../webview/editor.css'));
        const jsPath = vscode.Uri.file(path.join(__dirname, '../webview/editor.js'));

        // Transformar em URIs que o Webview consegue carregar
        const cssUri = panel.webview.asWebviewUri(cssPath);
        const jsUri = panel.webview.asWebviewUri(jsPath);

        // Adicionar Content Security Policy
        const cspMeta = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${panel.webview.cspSource}; script-src ${panel.webview.cspSource} https:;">`;

        // Substituir todos os placeholders
        html = html.replace(/{{TITLE}}/g, item.title)
            .replace(/{{CONTENT}}/g, escaped)
            .replace(/{{CSS_URI}}/g, cssUri.toString())
            .replace(/{{JS_URI}}/g, jsUri.toString())
            .replace('{{CSP_META}}', cspMeta);

        return html;
    }



    executeStep(item: StepItem): void {
        this.currentIndex = item.index;
        this.insertStepContent();
        this.refresh();
    }
}