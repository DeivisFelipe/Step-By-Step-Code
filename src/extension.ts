import * as vscode from 'vscode';

class StepItem extends vscode.TreeItem {
	constructor(
		public label: string,
		public title: string,
		public content: string,
		public index: number
	) {
		super(label);
		this.contextValue = 'stepItem';
	}
}

class StepProvider implements vscode.TreeDataProvider<StepItem> {
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

		panel.webview.html = this.getWebviewContent(item.title, item.content);

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

	private getWebviewContent(title: string, content: string): string {
		const escaped = content.replace(/</g, '&lt;').replace(/>/g, '&gt;');
		return `
			<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<title>${title}</title>
				<style>
					body { font-family: sans-serif; margin: 0; padding: 0; }
					textarea {
						width: 100%;
						height: 95vh;
						font-family: monospace;
						font-size: 14px;
						padding: 1em;
						box-sizing: border-box;
						border: none;
						outline: none;
						resize: none;
					}
				</style>
			</head>
			<body>
				<textarea id="editor">${escaped}</textarea>
				<script>
					const vscode = acquireVsCodeApi();
					const textarea = document.getElementById('editor');

					window.addEventListener('keydown', (e) => {
						if ((e.metaKey || e.ctrlKey) && e.key === 's') {
							e.preventDefault();
							vscode.postMessage({ command: 'save', content: textarea.value });
						}
					});
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

export function activate(context: vscode.ExtensionContext) {
	const stepProvider = new StepProvider();
	vscode.window.registerTreeDataProvider('stepView', stepProvider);

	console.log('Step-by-Step Code extension is now active!');

	context.subscriptions.push(
		vscode.commands.registerCommand('stepByStep.addStep', () => stepProvider.addStep()),
		vscode.commands.registerCommand('stepByStep.nextStep', () => stepProvider.nextStep()),
		vscode.commands.registerCommand('stepByStep.prevStep', () => stepProvider.prevStep()),
		vscode.commands.registerCommand('stepByStep.resetSteps', () => stepProvider.resetSteps()),
		vscode.commands.registerCommand('stepByStep.deleteStep', (item: StepItem) => stepProvider.deleteStep(item)),
		vscode.commands.registerCommand('stepByStep.renameStep', (item: StepItem) => stepProvider.renameStep(item)),
		vscode.commands.registerCommand('stepByStep.editStep', (item: StepItem) => stepProvider.editStep(item)),
		vscode.commands.registerCommand('stepByStep.executeStep', (item: StepItem) => stepProvider.executeStep(item))
	);
}

export function deactivate() {}
