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
                const prefix = step.index === this.currentIndex ? '▶ ' : '';
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
            
            // Abrir automaticamente a tela de edição
            await this.editStep(step);
        }
    }

    nextStep(): void {
        if (this.currentIndex < this.steps.length - 1) {
            this.currentIndex++;
            const step = this.steps[this.currentIndex];
            this.insertStepContent({
                deletePrevious: step?.deletePrevious,
                keepIndentation: step?.keepIndentation,
                enableAnimation: step?.enableAnimation
            });
            this.refresh();
        }
    }

    prevStep(): void {
        if (this.currentIndex > 0) {
            this.currentIndex--;
            const step = this.steps[this.currentIndex];
            this.insertStepContent({
                deletePrevious: step?.deletePrevious,
                keepIndentation: step?.keepIndentation,
                enableAnimation: step?.enableAnimation
            });
            this.refresh();
        }
    }

    private insertStepContent(options?: { deletePrevious?: boolean, keepIndentation?: boolean, enableAnimation?: boolean }): void {
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
        if (!step) {
            return;
        }

        if (!step.content) {
            vscode.window.showErrorMessage('O passo selecionado não possui conteúdo para inserir.');
            return;
        }

        let content = step.content;
        const position = editor.selection.active;
        const line = editor.document.lineAt(position.line);

        // Keep indentation: usar a indentação baseada na posição atual do cursor
        if (options?.keepIndentation) {
            const currentColumn = position.character;
            const baseIndent = ' '.repeat(currentColumn);
            content = content.split('\n').map((lineContent, index) => {
                return index === 0 ? lineContent : baseIndent + lineContent;
            }).join('\n');
        }

        if (options?.enableAnimation) {
            // Usar animação de digitação
            this.typeContentSlowly(editor, position, content, options);
        } else {
            // Inserção normal
            editor.edit(editBuilder => {
                // Delete previous: apagar conteúdo da linha atual
                if (options?.deletePrevious && line.text.trim()) {
                    const lineRange = line.range;
                    editBuilder.delete(lineRange);
                    editBuilder.insert(lineRange.start, content);
                } else {
                    editBuilder.insert(position, content + '\n');
                }
            });
        }
    }

    private async typeContentSlowly(editor: vscode.TextEditor, startPosition: vscode.Position, content: string, options: any): Promise<void> {
        const delay = 50; // ms entre cada caractere
        let currentPosition = startPosition;
        
        // Se delete previous está ativado, primeiro limpar a linha
        if (options?.deletePrevious) {
            const line = editor.document.lineAt(startPosition.line);
            if (line.text.trim()) {
                await editor.edit(editBuilder => {
                    editBuilder.delete(line.range);
                });
                currentPosition = new vscode.Position(startPosition.line, 0);
            }
        }
        
        // Digitar caractere por caractere
        for (let i = 0; i < content.length; i++) {
            await new Promise(resolve => setTimeout(resolve, delay));
            
            const char = content[i];
            
            await editor.edit(editBuilder => {
                editBuilder.insert(currentPosition, char);
            });
            
            // Atualizar posição baseada no caractere inserido
            if (char === '\n') {
                currentPosition = new vscode.Position(currentPosition.line + 1, 0);
            } else {
                currentPosition = new vscode.Position(currentPosition.line, currentPosition.character + 1);
            }
        }
        
        // Adicionar nova linha ao final se não terminar com quebra de linha
        if (!content.endsWith('\n')) {
            await editor.edit(editBuilder => {
                editBuilder.insert(currentPosition, '\n');
            });
        }
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
                retainContextWhenHidden: true,
                localResourceRoots: [vscode.Uri.file(path.join(__dirname, '../webview'))]
            }
        );

        panel.webview.html = this.getWebviewContent(item, panel);

        panel.webview.onDidReceiveMessage(
            message => {
                if (message.command === 'save') {
                    const step = this.steps[item.index];
                    if (step) {
                        step.content = message.content;
                        step.language = message.language || 'javascript';
                        step.deletePrevious = message.deletePrevious || false;
                        step.keepIndentation = message.keepIndentation || false;
                        step.enableAnimation = message.enableAnimation || false;
                        this.refresh();
                        vscode.window.showInformationMessage(`Conteúdo do passo "${step.title}" salvo.`);
                        
                        // Fechar o painel após salvar
                        panel.dispose();
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
        const fontPath = vscode.Uri.file(path.join(__dirname, '../webview/codicon.ttf'));

        // Transformar em URIs que o Webview consegue carregar
        const cssUri = panel.webview.asWebviewUri(cssPath);
        const jsUri = panel.webview.asWebviewUri(jsPath);
        const fontUri = panel.webview.asWebviewUri(fontPath);

        // Adicionar Content Security Policy mais permissivo para o Monaco
        const cspMeta = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${panel.webview.cspSource} https: data:; style-src ${panel.webview.cspSource} 'unsafe-inline'; script-src ${panel.webview.cspSource} 'unsafe-eval' 'unsafe-inline'; font-src ${panel.webview.cspSource};">`;

        // Substituir todos os placeholders
        html = html.replace(/{{TITLE}}/g, item.title)
            .replace(/{{CONTENT}}/g, escaped)
            .replace(/{{LANGUAGE}}/g, item.language)
            .replace(/{{DELETE_PREVIOUS}}/g, item.deletePrevious ? 'checked' : '')
            .replace(/{{KEEP_INDENTATION}}/g, item.keepIndentation ? 'checked' : '')
            .replace(/{{ENABLE_ANIMATION}}/g, item.enableAnimation ? 'checked' : '')
            .replace(/{{CSS_URI}}/g, cssUri.toString())
            .replace(/{{JS_URI}}/g, jsUri.toString())
            .replace('{{CSP_META}}', cspMeta)
            .replace(/url\("\.\/codicon\.ttf"\)/g, `url("${fontUri.toString()}")`);

        return html;
    }



    executeStep(item: StepItem): void {
        this.currentIndex = item.index;
        const step = this.steps[this.currentIndex];
        this.insertStepContent({
            deletePrevious: step?.deletePrevious,
            keepIndentation: step?.keepIndentation,
            enableAnimation: step?.enableAnimation
        });
        this.refresh();
    }
}