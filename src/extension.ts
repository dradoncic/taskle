import * as vscode from 'vscode';
import OpenAI from 'openai';
import { UIProvider } from './UIProvider';

async function grabAPIKey(context: vscode.ExtensionContext): Promise<string | undefined> {
    const apiKey = await vscode.window.showInputBox({
        ignoreFocusOut: true,
        placeHolder: 'OpenAI API Key',
        title: 'Taskle',
        prompt: 'Please enter your OpenAI API Key here.',
        validateInput: async (text) => {
            if (!text) {
                return 'Invalid OpenAI API Key';
            }
            try {
                const openai = new OpenAI({ apiKey: text });
                await openai.models.list();
            } catch (err) {
                return 'Invalid OpenAI API Key!';
            }
            return null;
        }
    });

    if (apiKey) {
        vscode.window.showInformationMessage('Valid OpenAI API Key');
        await context.secrets.store('taskle-APIKey', apiKey);
    }

    return apiKey;
}

async function validateAPIKey(apiKey: string): Promise<boolean> {
    try {
        const openai = new OpenAI({ apiKey });
        await openai.models.list();
        return true;
    } catch (err) {
        return false;
    }
}

export async function activate(context: vscode.ExtensionContext) {
    let apiKey = await context.secrets.get('taskle-APIKey');
    if (!apiKey || !(await validateAPIKey(apiKey))) {
        apiKey = await grabAPIKey(context);
    }

    if (apiKey) {
        const openai = new OpenAI({ apiKey });
        console.log('OpenAI API Key validated and set');
    }

    const provider = new UIProvider(context.extensionUri, context);
    context.subscriptions.push(vscode.window.registerWebviewViewProvider('taskle-sidebar', provider));
    console.log('UIProvider registered');
}

export function deactivate() {}
