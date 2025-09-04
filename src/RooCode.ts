/*
 * Chadson v69.69
 *
 * This file defines the RooCode class, which is the main entry point for the extension.
 * It is responsible for creating and managing the various components of the extension,
 * including the ClineProvider, the TaskRunner, and the API.
 */

import * as vscode from "vscode";

export class RooCode {
    constructor(public readonly extensionUri: vscode.Uri) {}
}