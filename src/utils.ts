import * as path from "path";
import * as vscode from "vscode";

export async function collectAndSaveChats(context: vscode.ExtensionContext): Promise<string> {
  const currentWorkspaceId = context.storageUri?.fsPath
    ? path.basename(path.dirname(context.storageUri.fsPath))
    : undefined;
  if (!currentWorkspaceId) {
    throw new Error("Current workspace ID not found");
  }

  return "Successfully collected and saved chats!";
}
