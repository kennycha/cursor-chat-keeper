import * as vscode from "vscode";
import { collectAndSaveChats } from "./utils";

export function activate(context: vscode.ExtensionContext) {
	let disposable = vscode.commands.registerCommand("cursor-chat-keeper.collectChats", async () => {
		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: "Cursor Chat Keeper",
			cancellable: false
		}, async (progress) => {
			try {
				progress.report({ message: "Collecting chats from Cursor..." });
				const result = await collectAndSaveChats(context, progress);
				vscode.window.showInformationMessage(result);
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error);
				vscode.window.showErrorMessage(`Failed to collect chats: ${errorMessage}`);
			}
		});
	});

	context.subscriptions.push(disposable);
}

export function deactivate() { }
