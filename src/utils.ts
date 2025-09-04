/*
 * Chadson v69.69
 *
 * This file contains utility functions and classes that are used throughout the extension.
 * It is designed to be a central location for common code, making it easier to maintain
 * and reuse.
 */

import * as vscode from "vscode";

export function getNonce() {
    let text = "";
    const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

export function getUri(
    webview: vscode.Webview,
    extensionUri: vscode.Uri,
    pathList: string[],
) {
    return webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, ...pathList));
}

export class Logger {
    constructor(private readonly context: string) {}

    public log(message: string, ...args: any[]) {
        console.log(`[${this.context}] ${message}`, ...args);
    }
}