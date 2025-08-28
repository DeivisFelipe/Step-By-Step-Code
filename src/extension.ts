import * as vscode from 'vscode';
import StepProvider from './tree/StepProvider';
import StepItem from './tree/StepItem';

export function activate(context: vscode.ExtensionContext) {
	const stepProvider = new StepProvider();
	vscode.window.registerTreeDataProvider('stepView', stepProvider);

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

export function deactivate() { }
