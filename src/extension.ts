import * as vscode from "vscode";
import { collectAndSaveChats } from "./utils";

export function activate(context: vscode.ExtensionContext) {
	let disposable = vscode.commands.registerCommand("cursor-chat-keeper.collectChats", async () => {
		vscode.window.showInformationMessage("Collecting chats from Cursor...");
		try {
			const result = await collectAndSaveChats(context);
			vscode.window.showInformationMessage(result);
		} catch (error) {
			vscode.window.showErrorMessage(`Failed to collect chats: ${error}`);
		}
	});

	context.subscriptions.push(disposable);
}

export function deactivate() { }
