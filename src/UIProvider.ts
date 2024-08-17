import * as vscode from "vscode";
import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';
import { setTimeout } from "timers/promises";
import sortable from 'sortablejs';

export class UIProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;
    private _context: vscode.ExtensionContext;

    constructor(private readonly _extensionUri: vscode.Uri, context: vscode.ExtensionContext) {
        this._context = context;
    }

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

        webviewView.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case 'webviewReady':
                    const tasks = this._loadTasks();
                    webviewView.webview.postMessage({ command: 'displayTasks', tasks});
                    break;
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
                case 'reorderTasks':
                    this._reorderTasks(message.taskOrder);
            }
        });
    }

    private async _processTask(task: string, depth: number) {
        const APIKey = await this._context.secrets.get('taskle-APIKey');

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
        tasks.push({ id: uuidv4(), text: '- ' + task });
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

    /* was going to implement a drag and drop reordering feature but for some reason I cannot get it to work*/
    private _reorderTasks(taskOrder: string[]) {
        console.log('Before reordering:', this._loadTasks());
        let tasks = this._loadTasks();
        tasks.sort((a, b) => taskOrder.indexOf(a.id) - taskOrder.indexOf(b.id));
        this._saveTasks(tasks);
        console.log('After reordering:', tasks);
        this._view?.webview.postMessage({command: 'displayTasks', tasks });
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'reset.css'));
        const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'vscode.css'));
        const styleMainUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'main.css'));

    const magicButtonUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'magic.svg'));
    const submitButtonUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'enter.svg'));
    const clearButtonUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'trash.svg'));

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
                <div class="top-row">
                    <style>
                        .accent {
                            accent-color: var(--vscode-button-hoverBackground);
                        }
                    </style>
                    <input type="range" class="accent" id="depth-scale" name="depth-scale" min="1" max="5" value="3">
                    <span id="depth-value">3</span>
                    <button id="magic-wand-button" type="button">
                        <img src="${magicButtonUri}" alt="Magic Wand">
                    </button>
                </div>
                <div class="bottom-row">
                    <input type="text" id="task-input" placeholder="Enter a task" />
                    <button id="submit-button" type="submit">
                        <img src="${submitButtonUri}" alt="Submit">
                    </button>
                </div>
            </form>
            <ul id="task-list"></ul>
            <button id="clear-tasks-button">
                <img src="${clearButtonUri}" alt="Clear All Tasks">
            </button>
            <script>
                const vscode = acquireVsCodeApi();

                const depthScale = document.getElementById('depth-scale');
                const depthValue = document.getElementById('depth-value');
                const magicWandButton = document.getElementById('magic-wand-button');
                const taskForm = document.getElementById('task-form');
                const taskInput = document.getElementById('task-input');
                const clearTasksButton = document.getElementById('clear-tasks-button');
                const taskList = document.getElementById('task-list');

                let useMagic = false;
                magicWandButton.classList.add('deactivated')

                // Update depth value display
                depthScale.addEventListener('input', () => {
                    depthValue.textContent = depthScale.value;
                });


                magicWandButton.addEventListener('click', () => {
                    useMagic = !useMagic;
                    if (useMagic) {
                        magicWandButton.classList.remove('deactivated');
                        magicWandButton.classList.add('active');
                    } else {
                        magicWandButton.classList.remove('active');
                        magicWandButton.classList.add('deactivated');
                    }
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
                            taskList.innerHTML = '';
                            message.tasks.forEach(task => {
                                const li = document.createElement('li');
                                li.classList.add('task-item');
                                li.dataset.id = task.id;

                                const checkbox = document.createElement('input');
                                checkbox.type = 'checkbox';

                                const taskText = document.createElement('span');
                                taskText.classList.add('task-text');
                                taskText.textContent = task.text;

                                checkbox.addEventListener('change', async () => {
                                    console.log('Delete Inititated');
                                    taskText.style.textDecoration = "line-through";
                                    await new Promise(resolve => setTimeout(resolve, 750)); 
                                    vscode.postMessage({ command: 'deleteTask', taskId: task.id });
                                });

                                li.appendChild(checkbox);
                                li.appendChild(taskText);
                                taskList.appendChild(li);
                            });
                            break;
                    }
                });

                window.addEventListener('load', () => {
                    vscode.postMessage({ command: 'webviewReady'});
                });

            </script>
        </body>
        </html>`;
    }
}
