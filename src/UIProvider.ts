import * as vscode from "vscode";
import OpenAi from 'openai';
import { get } from "http";

export class UIProvider implements vscode.WebviewViewProvider {
    _view?: vscode.WebviewView;

    constructor(private readonly _extensionUri: vscode.Uri) {}

    public resolveWebviewView(webviewView: vscode.WebviewView, context: vscode.WebviewViewResolveContext, token: vscode.CancellationToken): Thenable<void> | void {
        this._view = webviewView;

        webviewView.webview.options ={
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case 'processTask':
                    const APIKey = vscode.workspace.getConfiguration('taskle').get<string>('APIKey');

                    if (APIKey)  {
                        const openai = new OpenAi({
                            apiKey: APIKey
                        });
                        try {
                            const system_prompt="You are an assistant skilled in breaking down complex tasks into subtasks. Your goal is to read the user's task and break it down into a list of subtasks. Provide only the bullet point list of subtasks without additional explanation.";

                            const response = await openai.chat.completions.create({
                                model: "gpt-3.5-turbo",
                                messages: [
                                    {"role": "system", "content": system_prompt},
                                    {"role": "user", "content": message.task}
                                ],
                                temperature:  0.2 + (message.depth - 1) * 0.2,
                                max_tokens:  50 + (message.depth -1 ) * 50
                            });
                            const breakdown = response.choices[0]?.message?.content?.trim() ?? '';
                            const tasks = breakdown.split('\n').filter(bp => bp.trim());

                            if (tasks.length > 0) {
                                tasks.pop();
                            }

                            this._view?.webview.postMessage({ command: 'displayTasks', tasks});
                            
                        } catch (err) {
                            vscode.window.showErrorMessage('Failed to breakdown task.');
                        }
                    } else {
                        vscode.window.showErrorMessage('API Key is not yet set.');
                    }
                    break;
            }
        });
    }


    private _getHtmlForWebview(webview: vscode.Webview): string {
        const styleResetUri =webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'reset.css'));
        const styleVSCodeUri =webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'vscode.css'));
        const styleMainUri =webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'main.css'));

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
            <input type="range" id="depth-scale" name="depth-scale" min="1" max="5" value="3">
            <span id="depth-value">3</span>
            <button type="submit">Break Down Task</button>
        </form>
        <ul id="task-list"></ul>
        <script>
            const vscode = acquireVsCodeApi();

            // Update depth value display
            const depthScale = document.getElementById('depth-scale');
            const depthValue = document.getElementById('depth-value');
            depthScale.addEventListener('input', () => {
                depthValue.textContent = depthScale.value;
            });

            document.getElementById('task-form').addEventListener('submit', (e) => {
                e.preventDefault();
                const task = document.getElementById('task-input').value;
                const depth = document.getElementById('depth-scale').value;
                vscode.postMessage({ command: 'processTask', task, depth });
            });

            window.addEventListener('message', event => {
                const message = event.data;
                switch (message.command) {
                    case 'displayTasks':
                        const taskList = document.getElementById('task-list');
                        taskList.innerHTML = '';
                        message.tasks.forEach(task => {
                            const li = document.createElement('li');
                            li.textContent = task;
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