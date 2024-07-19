import * as vscode from "vscode";
import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';

export class UIProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;

    constructor(private readonly _extensionUri: vscode.Uri) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        token: vscode.CancellationToken
    ): Thenable<void> | void {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        const tasks = this._loadTasks();
        webviewView.webview.postMessage({ command: 'displayTasks', tasks });

        webviewView.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case 'processTask':
                    await this._processTask(message.task, message.depth);
                    break;
                case 'addTask':
                    this._addTask(message.task);
                    break;
                case 'clearTasks':
                    this._clearTasks();
                    break;
                case 'deleteTask':
                    this._deleteTask(message.taskId);
                    break;
            }
        });
    }

    private async _processTask(task: string, depth: number) {
        const APIKey = vscode.workspace.getConfiguration('taskle').get<string>('APIKey');

        if (APIKey) {
            const openai = new OpenAI({
                apiKey: APIKey
            });
            try {
                const systemPrompt = "You are an assistant skilled in breaking down complex tasks into subtasks. Your goal is to read the user's task and break it down into a list of subtasks. Provide only the bullet point list of subtasks without additional explanation.";

                const response = await openai.chat.completions.create({
                    model: "gpt-3.5-turbo",
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: task }
                    ],
                    temperature: 0.2 + (depth - 1) * 0.2,
                    max_tokens: 50 + (depth - 1) * 50
                });

                const breakdown = response.choices[0]?.message?.content?.trim() ?? '';
                const tasks = breakdown.split('\n').filter(bp => bp.trim()).map(task => ({ id: uuidv4(), text: task }));

                // Remove the last element if it's incomplete
                if (tasks.length > 0) {
                    tasks.pop();
                }

                const oldTasks = this._loadTasks();
                const updatedTasks = [...oldTasks, ...tasks];
                this._saveTasks(updatedTasks);
                this._view?.webview.postMessage({ command: 'displayTasks', tasks: updatedTasks });

            } catch (err) {
                vscode.window.showErrorMessage('Failed to breakdown task.');
            }
        } else {
            vscode.window.showErrorMessage('API Key is not yet set.');
        }
    }

    private _loadTasks(): { id: string, text: string }[] {
        const tasks = vscode.workspace.getConfiguration('taskle').get<{ id: string, text: string }[]>('tasks', []);
        return tasks;
    }

    private _saveTasks(tasks: { id: string, text: string }[]) {
        vscode.workspace.getConfiguration('taskle').update('tasks', tasks, vscode.ConfigurationTarget.Global);
    }

    private _addTask(task: string) {
        const tasks = this._loadTasks();
        tasks.push({ id: uuidv4(), text: task });
        this._saveTasks(tasks);
        this._view?.webview.postMessage({ command: 'displayTasks', tasks });
    }

    private _clearTasks() {
        this._saveTasks([]);
        this._view?.webview.postMessage({ command: 'displayTasks', tasks: [] });
    }

    private _deleteTask(taskId: string) {
        let tasks = this._loadTasks();
        tasks = tasks.filter(t => t.id !== taskId);
        this._saveTasks(tasks);
        this._view?.webview.postMessage({ command: 'displayTasks', tasks });
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'reset.css'));
        const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'vscode.css'));
        const styleMainUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'main.css'));

        return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <link href="${styleResetUri}" rel="stylesheet">
            <link href="${styleVSCodeUri}" rel="stylesheet">
            <link href="${styleMainUri}" rel="stylesheet">
            <title>Taskle</title>
        </head>
        <body>
            <form id="task-form">
                <input type="text" id="task-input" placeholder="Enter a task" />
                <label for="depth-scale">Depth Scale (1-5):</label>
                <button id="magic-wand-button" type="button">✨</button>
                <button id="submit-button" type="submit">✈️</button>
                <input type="range" id="depth-scale" name="depth-scale" min="1" max="5" value="3">
                <span id="depth-value">3</span>
            </form>
            <ul id="task-list"></ul>
            <button id="clear-tasks-button">Clear All Tasks</button>
            <script>
                const vscode = acquireVsCodeApi();

                const depthScale = document.getElementById('depth-scale');
                const depthValue = document.getElementById('depth-value');
                const magicWandButton = document.getElementById('magic-wand-button');
                const taskForm = document.getElementById('task-form');
                const taskInput = document.getElementById('task-input');
                const clearTasksButton = document.getElementById('clear-tasks-button');

                let useMagic = false;

                // Update depth value display
                depthScale.addEventListener('input', () => {
                    depthValue.textContent = depthScale.value;
                });

                // Toggle magic wand
                magicWandButton.addEventListener('click', () => {
                    useMagic = !useMagic;
                    magicWandButton.classList.toggle('active', useMagic);
                });

                taskForm.addEventListener('submit', (e) => {
                    e.preventDefault();
                    const task = document.getElementById('task-input').value;
                    const depth = document.getElementById('depth-scale').value;

                    if (useMagic) {
                        vscode.postMessage({ command: 'processTask', task, depth });
                    } else {
                        vscode.postMessage({ command: 'addTask', task });
                    }

                    taskInput.value = '';
                });

                clearTasksButton.addEventListener('click', () => {
                    vscode.postMessage({ command: 'clearTasks' });
                });

                window.addEventListener('message', event => {
                    const message = event.data;
                    switch (message.command) {
                        case 'displayTasks':
                            const taskList = document.getElementById('task-list');
                            taskList.innerHTML = '';
                            message.tasks.forEach(task => {
                                const li = document.createElement('li');
                                const checkbox = document.createElement('input');
                                checkbox.type = 'checkbox';
                                checkbox.addEventListener('change', () => {
                                    vscode.postMessage({ command: 'deleteTask', taskId: task.id });
                                });
                                li.appendChild(checkbox);
                                li.appendChild(document.createTextNode(task.text));
                                taskList.appendChild(li);
                            });
                            break;
                    }
                });
            </script>
        </body>
        </html>`;
    }
}
