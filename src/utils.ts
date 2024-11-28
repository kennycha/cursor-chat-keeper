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

async function ensureTabsDirectory(): Promise<string> {
  const tabsPath = path.join(getProjectPath(), 'tabs');
  await fs.mkdir(tabsPath, { recursive: true });
  return tabsPath;
}

export async function updateCursorChatMarkdown(data: ChatData): Promise<void> {
  const markdownPath = path.join(getProjectPath(), 'cursor-chat.md');
  const tabsPath = await ensureTabsDirectory();

  const indexContent: string[] = ['# Cursor Chat History\n'];
  indexContent.push('아래 채팅 목록을 클릭하여 상세 내용을 확인하세요.\n');

  for (const tab of data.tabs) {
    const tabTitle = tab.chatTitle || 'Untitled Chat';
    const tabFileName = `${tab.tabId}.md`;

    indexContent.push(`- [${tabTitle}](tabs/${tabFileName})`);
    if (tab.lastSendTime) {
      indexContent.push(`  *(${formatDate(new Date(tab.lastSendTime))})*`);
    }
    indexContent.push('');

    const tabContent: string[] = [];
    tabContent.push(`# ${tabTitle}\n`);
    if (tab.lastSendTime) {
      tabContent.push(`**마지막 대화**: ${formatDate(new Date(tab.lastSendTime))}\n`);
    }
    tabContent.push(`[목차로 돌아가기](../cursor-chat.md)\n`);

    tab.bubbles.forEach(bubble => {
      tabContent.push(bubbleToMarkdown(bubble));
      tabContent.push('\n');
    });

    await fs.writeFile(path.join(tabsPath, tabFileName), tabContent.join('\n'));
  }

  await fs.writeFile(markdownPath, indexContent.join('\n'));
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