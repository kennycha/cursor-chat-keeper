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
    throw new Error(`Failed to collect scripts: ${error}`);
  }

  return "Scripts successfully collected and saved!";
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

    // Tab ID marker
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

    // Bubble ID marker
    const bubbleMatch = line.match(/^<!-- Bubble ID: ([a-zA-Z0-9-]+) -->/);
    if (bubbleMatch && currentTabId) {
      currentBubbles.add(bubbleMatch[1]);
    }

    if (currentTabId) {
      currentTabContent.push(line);
    }
  }

  // Don't forget to save the last tab
  if (currentTabId) {
    tabs.set(currentTabId, {
      content: currentTabContent.join('\n'),
      bubbles: currentBubbles,
      lastPosition: position
    });
  }

  return { tabs };
}

// Function to convert a single bubble to markdown
function bubbleToMarkdown(bubble: Bubble): string {
  const parts: string[] = [];

  // Add bubble ID marker
  parts.push(`<!-- Bubble ID: ${bubble.id} -->`);

  // Add author indicator
  const author = bubble.type === 'user' ? '👤 User' : '🤖 AI';
  parts.push(`### ${author}`);

  // Add main content
  if (bubble.text) {
    parts.push(bubble.text);
  }

  // Add notepads if they exist
  if (bubble.notepads && bubble.notepads.length > 0) {
    parts.push('\n#### Notepads:');
    bubble.notepads.forEach((notepad, index) => {
      parts.push(`${index + 1}. ${JSON.stringify(notepad.text)}`);
    });
  }

  // Add additional non-false boolean fields and relevant information
  Object.entries(bubble).forEach(([key, value]) => {
    if (typeof value === 'boolean' && value === true && key !== 'type') {
      parts.push(`\n**${key}**: ${value}`);
    }
  });

  // Add AI-specific information if present
  if (bubble.type === 'ai') {
    if (bubble.modelType) {
      parts.push(`\n**Model**: ${bubble.modelType}`);
    }
  }

  return parts.join('\n\n');
}

// Function to convert a single tab to markdown
function tabToMarkdown(tab: Tab, existingBubbles: Set<string> = new Set()): string {
  const parts: string[] = [];

  // Add tab ID marker
  parts.push(`<!-- Tab ID: ${tab.tabId} -->`);

  // Add tab header
  const title = tab.chatTitle || 'Untitled Chat';
  parts.push(`# ${title}`);
  parts.push(`**Tab State**: ${tab.tabState}`);
  if (tab.lastSendTime) {
    parts.push(`**Last Activity**: ${new Date(tab.lastSendTime).toISOString()}`);
  }
  parts.push('\n---\n');

  // Add new bubbles only
  tab.bubbles.forEach((bubble, index) => {
    if (!existingBubbles.has(bubble.id)) {
      if (index > 0) {
        parts.push('\n---\n');
      }
      parts.push(bubbleToMarkdown(bubble));
    }
  });

  return parts.join('\n');
}

// Main function to incrementally update markdown file
export async function updateCursorChatMarkdown(
  data: ChatData,
): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    throw new Error('No workspace folders found');
  }
  const markdownPath = path.join(workspaceFolders[0].uri.fsPath, 'cursor-chat.md');

  let existingContent = '';
  let parsedContent: ParsedContent = { tabs: new Map() };

  try {
    existingContent = await fs.readFile(markdownPath, 'utf-8');
    parsedContent = parseExistingMarkdown(existingContent);
  } catch (error) {
    // File doesn't exist yet, start fresh
    existingContent = '# Cursor Chat History\n\n';
  }

  const newContent: string[] = [existingContent.trim()];

  // Process each tab
  for (const tab of data.tabs) {
    const existingTab = parsedContent.tabs.get(tab.tabId);

    if (existingTab) {
      // Check for new bubbles
      const newBubblesContent = tabToMarkdown(tab, existingTab.bubbles);
      if (newBubblesContent.includes('### ')) { // Only append if there are new messages
        newContent.push('\n\n## ==============================\n\n');
        newContent.push(newBubblesContent);
      }
    } else {
      // New tab
      newContent.push('\n\n## ==============================\n\n');
      newContent.push(tabToMarkdown(tab));
    }
  }

  // Write the updated content back to file
  await fs.writeFile(markdownPath, newContent.join(''));
}
