import * as sqlite from "@vscode/sqlite3";
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";
import { Bubble, ChatData } from "./legacy-types";
import { ComposerChat, ComposerData } from "./ref-types";

function getCursorPath(): string {
  switch (process.platform) {
    case "darwin":
      return path.join(os.homedir(), "Library", "Application Support", "Cursor");
    case "win32":
      return path.join(os.homedir(), "%APPDATA%", "Roaming", "Cursor");
    case "linux":
      return path.join(os.homedir(), ".config", "Cursor");
    default:
      throw new Error("Unsupported platform");
  }
}

function initDatabase(dbPath: string): Promise<sqlite.Database> {
  return new Promise((resolve, reject) => {
    const db = new sqlite.Database(dbPath, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve(db);
      }
    });
  });
}

function terminateDatabase(db: sqlite.Database): Promise<void> {
  return new Promise((resolve, reject) => {
    db.close((error) => {
      if (error) {
        reject(error);
      } else {
        resolve(void 0);
      }
    });
  });
}

// @TODO kenny: chat 저장 위치나 방법이 바뀐 것 같음
// 'composer.composerData' 에는 모든 데이터가 들어있는데, 'workbench.panel.aichat.view.aichat.chatdata' 에는 아님
function getChatData(db: sqlite.Database): Promise<ChatData> {
  return new Promise((resolve, reject) => {
    db.get(
      `
    SELECT value FROM ItemTable 
    WHERE [key] = ('workbench.panel.aichat.view.aichat.chatdata')
  `,
      (error, row) => {
        if (error) {
          reject(error);
        } else {
          const chatData: ChatData = JSON.parse((row as any).value);
          resolve(chatData);
        }
      }
    );
  });
}

function getComposerData(db: sqlite.Database): Promise<ComposerData> {
  return new Promise((resolve, reject) => {
    db.get(
      `
    SELECT value FROM ItemTable 
    WHERE [key] = ('composer.composerData')
  `,
      (error, row) => {
        if (error) {
          reject(error);
        } else {
          const composerData: ComposerData = JSON.parse((row as any).value);
          resolve(composerData);
        }
      }
    );
  });
}

function getComposerBodyData(db: sqlite.Database, keys: string[], placeHolders: string): Promise<ComposerChat[]> {
  return new Promise((resolve, reject) => {
    db.all(
      `
      SELECT value FROM cursorDiskKV 
      WHERE [key] in (${placeHolders})
    `, keys,
      (error, rows) => {
        if (error) {
          reject(error);
        } else {
          const composerBodyData: ComposerChat[] = rows.map((row) => JSON.parse((row as any).value));
          resolve(composerBodyData);
        }
      }
    );
  });
}

function getProjectPath(): string {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    throw new Error("No workspace found.");
  }
  return workspaceFolders[0].uri.fsPath;
}

function removeProjectPath(path: string): string {
  return path.replace(getProjectPath(), "");
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");

  return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
}

function bubbleToMarkdown(bubble: Bubble): string {
  const parts: string[] = [];
  parts.push(`<!-- Bubble ID: ${bubble.id} -->`);
  const author = bubble.type === "user" ? "👤 User" : `🤖 AI (${bubble.modelType})`;
  parts.push(`**${author}**\n`);

  if (bubble.text) {
    parts.push(`${bubble.text}\n`);
  }

  if (bubble.selections?.length || bubble.fileSelections?.length || bubble.folderSelections?.length) {
    parts.push(`**Code / File / Folder**\n`);

    bubble.selections?.forEach((selection) => {
      parts.push(
        `<details><summary>Code ${removeProjectPath(selection.uri.path)} (line ${selection.range.selectionStartLineNumber
        })</summary>\n`
      );
      parts.push(selection.text);
      parts.push("</details>");
    });

    bubble.fileSelections?.forEach((file) => {
      parts.push(`File ${removeProjectPath(file.uri.path)}\n`);
    });

    bubble.folderSelections?.forEach((folder) => {
      parts.push(`Folder ${removeProjectPath(folder.uri.path)}\n`);
    });
  }

  return parts.join("\n");
}

async function ensureDirectories(): Promise<{ rootPath: string; tabsPath: string }> {
  const rootPath = path.join(getProjectPath(), "cursor-chats");
  const tabsPath = path.join(rootPath, "tabs");

  await fs.mkdir(rootPath, { recursive: true });
  await fs.mkdir(tabsPath, { recursive: true });

  return { rootPath, tabsPath };
}

export async function updateCursorChatMarkdown(data: ChatData): Promise<void> {
  const { rootPath, tabsPath } = await ensureDirectories();
  const indexPath = path.join(rootPath, "index.md");

  const indexContent: string[] = ["# Cursor Chat History\n"];
  indexContent.push("Click on the chat items below to view details.\n");

  for (const tab of data.tabs) {
    const tabTitle = tab.chatTitle || "Untitled Chat";
    const tabFileName = `${tab.tabId}.md`;

    indexContent.push(`- [${tabTitle}](tabs/${tabFileName})`);
    if (tab.lastSendTime) {
      indexContent.push(`  *(${formatDate(new Date(tab.lastSendTime))})*`);
    }
    indexContent.push("");

    const tabContent: string[] = [];
    tabContent.push(`# ${tabTitle}\n`);
    if (tab.lastSendTime) {
      tabContent.push(`**Last Conversation**: ${formatDate(new Date(tab.lastSendTime))}\n`);
    }
    tabContent.push(`[Back to Index](../index.md)\n`);

    tab.bubbles.forEach((bubble) => {
      tabContent.push(bubbleToMarkdown(bubble));
      tabContent.push("\n");
    });

    await fs.writeFile(path.join(tabsPath, tabFileName), tabContent.join("\n"));
  }

  await fs.writeFile(indexPath, indexContent.join("\n"));
}

export async function updateCursorComposerMarkdown(data: unknown): Promise<void> {
  console.log('data: ', data);
}

export async function collectAndSaveChats(context: vscode.ExtensionContext): Promise<string> {
  const currentWorkspaceId = context.storageUri?.fsPath
    ? path.basename(path.dirname(context.storageUri.fsPath))
    : undefined;
  if (!currentWorkspaceId) {
    throw new Error("Current workspace ID not found");
  }
  const workspacePath = path.join(getCursorPath(), "User", "workspaceStorage");
  const dbPath = path.join(workspacePath, currentWorkspaceId, "state.vscdb");

  try {
    const db = await initDatabase(dbPath);
    const chatData = await getChatData(db);
    const composerData = await getComposerData(db);
    await terminateDatabase(db);

    if (chatData) {
      await updateCursorChatMarkdown(chatData);
    }
    if (composerData) {
      const globalDbPath = path.join(workspacePath, '..', "globalStorage", "state.vscdb");
      const keys = composerData.allComposers.map(({ composerId }) => `composerData:${composerId}`);
      const placeHolders = keys.map(() => "?").join(",");
      const globalDb = await initDatabase(globalDbPath);
      const composerBodyData = await getComposerBodyData(globalDb, keys, placeHolders);
      await terminateDatabase(globalDb);
      await updateCursorComposerMarkdown(composerBodyData);
    }


  } catch (error) {
    throw new Error(`Failed to collect chats: ${error}`);
  }

  return "Chats successfully collected and saved!";
}
