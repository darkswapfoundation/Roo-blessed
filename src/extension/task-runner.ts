/*
 * Chadson v69.69
 *
 * This file defines the TaskRunner class, which is responsible for creating and managing tasks
 * in a headless environment. It is designed to be completely independent of the ClineProvider
 * and the webview, allowing for a clean separation of concerns between the GUI and the core
 * task execution logic.
 *
 * This refactoring was prompted by the discovery that the existing task creation logic was
 * too tightly coupled to the GUI, preventing headless tasks from being executed correctly.
 * By creating a dedicated TaskRunner, we can ensure that tasks can be created and managed
 * reliably, regardless of whether a GUI is present.
 */

import * as vscode from "vscode";
import { API } from "./api";
import { RooCode } from "../RooCode";
import { ClineProvider } from "../core/webview/ClineProvider";
import { Logger } from "../utils";
import { Task } from "../core/task/Task";
import { RooCodeEventName } from "@roo-code/types";

export class TaskRunner {
    private readonly logger = new Logger("task-runner");

    constructor(
        private readonly extensionUri: vscode.Uri,
        private readonly rooCode: RooCode,
        private readonly api: API,
        private readonly sidebarProvider: ClineProvider,
    ) {}

    public async createTask(
        text?: string,
        images?: string[],
        clientId?: string,
    ): Promise<string> {
        this.logger.log("Creating new task...");

        const {
   apiConfiguration,
   diffEnabled: enableDiff,
   enableCheckpoints,
   fuzzyMatchThreshold,
   experiments,
  } = await this.sidebarProvider.getState()

        const task = new Task({
            provider: this.sidebarProvider,
            apiConfiguration,
            enableDiff,
            enableCheckpoints,
            fuzzyMatchThreshold,
            task: text,
            images,
            experiments,
            clientId,
            onCreated: (cline) => this.api.emit(RooCodeEventName.TaskCreated, cline.taskId),
        });

        await this.sidebarProvider.addClineToStack(task);

        task.on("taskStarted", () => {
            this.logger.log(`[TaskRunner] Task started with ID: ${task.taskId}, client: ${task.clientId}`);
            this.api.emit(RooCodeEventName.TaskStarted, task.taskId);
        });

        this.api.emit(RooCodeEventName.TaskCreated, task.taskId);

        this.logger.log(`[TaskRunner] Task created with ID: ${task.taskId}`);

        return task.taskId;
    }
}