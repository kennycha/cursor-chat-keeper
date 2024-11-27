import * as sqlite from "@vscode/sqlite3";
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";
import { Bubble, ChatData, ParsedContent, Tab, TabContent } from "./types";

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

function getChatData(db: sqlite.Database): Promise<ChatData> {
  return new Promise((resolve, reject) => {
    db.get(
      `
    SELECT value FROM ItemTable 
    WHERE [key] IN ('workbench.panel.aichat.view.aichat.chatdata')
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

function getProjectPath(): string {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    throw new Error('No workspace found.');
  }
  return workspaceFolders[0].uri.fsPath;
}

function removeProjectPath(path: string): string {
  return path.replace(getProjectPath(), '');
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
}

function bubbleToMarkdown(bubble: Bubble): string {
  const parts: string[] = [];
  parts.push(`<!-- Bubble ID: ${bubble.id} -->`);
  const author = bubble.type === 'user' ? '👤 User' : `🤖 AI (${bubble.modelType})`;
  parts.push(`**${author}**\n`);

  if (bubble.text) {
    parts.push(`${bubble.text}\n`);
  }

  if (bubble.selections?.length || bubble.fileSelections?.length || bubble.folderSelections?.length) {
    parts.push(`**Code / File / Folder**\n`);

    bubble.selections?.forEach(selection => {
      parts.push(`<details><summary>Code ${removeProjectPath(selection.uri.path)} (line ${selection.range.selectionStartLineNumber})</summary>\n`);
      parts.push(selection.text);
      parts.push('</details>');
    });

    bubble.fileSelections?.forEach(file => {
      parts.push(`File ${removeProjectPath(file.uri.path)}\n`);
    });

    bubble.folderSelections?.forEach(folder => {
      parts.push(`Folder ${removeProjectPath(folder.uri.path)}\n`);
    });
  }

  return parts.join('\n');
}

function tabToMarkdown(tab: Tab, existingBubbles: Set<string> = new Set()): string {
  const parts: string[] = [];
  parts.push(`<!-- Tab ID: ${tab.tabId} -->`);

  const title = tab.chatTitle || 'Untitled Chat';
  parts.push(`## ${title}`);
  if (tab.lastSendTime) {
    parts.push(`**Last Send Time**: ${formatDate(new Date(tab.lastSendTime))}\n`);
  }

  tab.bubbles.forEach(bubble => {
    if (!existingBubbles.has(bubble.id)) {
      parts.push(bubbleToMarkdown(bubble));
      parts.push('\n');
    }
  });

  return parts.join('\n');
}

function parseExistingMarkdown(content: string): ParsedContent {
  const tabs = new Map<string, TabContent>();
  let currentTabId: string | null = null;
  let currentTabContent: string[] = [];
  let currentBubbles = new Set<string>();
  let position = 0;

  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    position += line.length + 1; // +1 for newline

    const tabMatch = line.match(/^<!-- Tab ID: ([a-zA-Z0-9-]+) -->/);
    if (tabMatch) {
      if (currentTabId) {
        tabs.set(currentTabId, {
          content: currentTabContent.join('\n'),
          bubbles: currentBubbles,
          lastPosition: position
        });
      }
      currentTabId = tabMatch[1];
      currentTabContent = [line];
      currentBubbles = new Set<string>();
      continue;
    }

    const bubbleMatch = line.match(/^<!-- Bubble ID: ([a-zA-Z0-9-]+) -->/);
    if (bubbleMatch && currentTabId) {
      currentBubbles.add(bubbleMatch[1]);
    }

    if (currentTabId) {
      currentTabContent.push(line);
    }
  }

  if (currentTabId) {
    tabs.set(currentTabId, {
      content: currentTabContent.join('\n'),
      bubbles: currentBubbles,
      lastPosition: position
    });
  }

  return { tabs };
}

export async function updateCursorChatMarkdown(data: ChatData): Promise<void> {
  const markdownPath = path.join(getProjectPath(), 'cursor-chat.md');

  let existingContent = '';
  let parsedContent: ParsedContent = { tabs: new Map() };

  try {
    const fileExists = await fs.access(markdownPath)
      .then(() => true)
      .catch(() => false);

    if (fileExists) {
      existingContent = await fs.readFile(markdownPath, 'utf-8');
      parsedContent = parseExistingMarkdown(existingContent);
    }
  } catch (error) {
    existingContent = '# Cursor Chats\n\n';
  }

  const newContent: string[] = ['# Cursor Chats\n'];

  data.tabs.forEach((tab, index) => {
    const existingTab = parsedContent.tabs.get(tab.tabId);

    if (existingTab) {
      if (index > 0) {
        newContent.push('\n---\n');
      }

      newContent.push(`<!-- Tab ID: ${tab.tabId} -->`);
      newContent.push(`## ${tab.chatTitle || 'Untitled Chat'}`);
      if (tab.lastSendTime) {
        newContent.push(`**Last Send Time**: ${formatDate(new Date(tab.lastSendTime))}\n`);
      }

      const existingLines = existingTab.content.split('\n');
      const bubbleStartIndex = existingLines.findIndex(line => line.includes('<!-- Bubble ID:'));
      if (bubbleStartIndex !== -1) {
        const existingBubbles = existingLines.slice(bubbleStartIndex).join('\n');
        newContent.push(existingBubbles);
      }

      const newBubbles = tab.bubbles.filter(bubble => !existingTab.bubbles.has(bubble.id));
      if (newBubbles.length > 0) {
        newContent.push('');
        newBubbles.forEach(bubble => {
          newContent.push(bubbleToMarkdown(bubble));
          newContent.push('');
        });
      }
    } else {
      if (index > 0) {
        newContent.push('\n---\n');
      }
      newContent.push(tabToMarkdown(tab));
    }
  });

  await fs.writeFile(markdownPath, newContent.join('\n'));
}


export async function collectAndSaveChats(context: vscode.ExtensionContext): Promise<string> {
  const currentWorkspaceId = context.storageUri?.fsPath
    ? path.basename(path.dirname(context.storageUri.fsPath))
    : undefined;
  if (!currentWorkspaceId) {
    throw new Error("Current workspace ID not found");
  }
  const dbPath = path.join(getCursorPath(), "User", "workspaceStorage", currentWorkspaceId, "state.vscdb");
  try {
    const db = await initDatabase(dbPath);
    const chatData = await getChatData(db);

    await updateCursorChatMarkdown(chatData);

    db.close();
  } catch (error) {
    throw new Error(`Failed to collect chats: ${error}`);
  }

  return "Chats successfully collected and saved!";
}