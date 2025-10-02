import * as vscode from 'vscode';

export default class StepItem extends vscode.TreeItem {
    public language: string = "javascript";
    public deletePrevious: boolean = false;
    public keepIndentation: boolean = false;
    public enableAnimation: boolean = false;

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
