import * as vscode from 'vscode';
import OpenAI from 'openai';
import { UIProvider } from './UIProvider';

async function grabAPIKey(): Promise<string | undefined> {
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
		await vscode.workspace.getConfiguration('taskle').update('APIKey', apiKey, true);
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
	let apiKey = vscode.workspace.getConfiguration('taskle').get<string>('APIKey');
	if (!apiKey || !(await validateAPIKey(apiKey))) {
		apiKey = await grabAPIKey();
	};

	if (apiKey) {
		const openai = new OpenAI({ apiKey });
	};

    const provider = new UIProvider(context.extensionUri);
    context.subscriptions.push(vscode.window.registerWebviewViewProvider('taskle-sidebar', provider));
}

export function deactivate() {}
