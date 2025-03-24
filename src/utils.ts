import * as sqlite from "@vscode/sqlite3";
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";
import { ComposerBodyDatum, ComposerConversation, ComposerData } from "./types";

export async function collectAndSaveChats(context: vscode.ExtensionContext): Promise<string> {
  if (!context.storageUri) {
    throw new Error("Storage URI not found");
  }
  const basePath = getBasePath();
  const currentWorkspaceId = getCurrentWorkspaceId(context.storageUri.fsPath);
  const workspaceDbPath = path.join(basePath, 'workspaceStorage', currentWorkspaceId, "state.vscdb");

  try {
    const db = await initDatabase(workspaceDbPath);
    const composerData = await queryComposerData(db);
    await terminateDatabase(db);

    if (!composerData) {
      return "No composer data found";
    }

    const globalDbPath = path.join(basePath, 'globalStorage', "state.vscdb");
    const globalDb = await initDatabase(globalDbPath);
    const keys = composerData.allComposers.map(({ composerId }) => `composerData:${composerId}`);
    const placeHolders = keys.map(() => "?").join(",");
    const composerBodyData = await queryComposerBodyData(globalDb, keys, placeHolders);
    await terminateDatabase(globalDb);
    const sorted = composerBodyData.toSorted((a, b) => b.createdAt - a.createdAt);
    await composerBodyDataToMarkdown(sorted);

  } catch (error) {
    throw new Error(`Failed to collect chats: ${error}`);
  }

  return "Successfully collected and saved chats!";
}

function getCurrentWorkspaceId(storagePath: string): string {
  return path.basename(path.dirname(storagePath));
}

function getBasePath(): string {
  switch (process.platform) {
    case "darwin":
      return path.join(os.homedir(), "Library", "Application Support", "Cursor", 'User');
    case "win32":
      return path.join(os.homedir(), "%APPDATA%", "Roaming", "Cursor", 'User');
    case "linux":
      return path.join(os.homedir(), ".config", "Cursor", 'User');
    default:
      throw new Error("Unsupported platform");
  }
}

function getProjectPath(): string {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    throw new Error("No workspace found.");
  }
  return workspaceFolders[0].uri.fsPath;
}

async function initDatabase(dbPath: string): Promise<sqlite.Database> {
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

async function terminateDatabase(db: sqlite.Database): Promise<void> {
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

async function queryComposerData(db: sqlite.Database): Promise<ComposerData> {
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

async function queryComposerBodyData(db: sqlite.Database, keys: string[], placeHolders: string): Promise<ComposerBodyDatum[]> {
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
          const composerBodyData: ComposerBodyDatum[] = rows.map((row) => JSON.parse((row as any).value));
          resolve(composerBodyData);
        }
      }
    );
  });
}

async function composerBodyDataToMarkdown(composerBodyData: ComposerBodyDatum[]): Promise<void> {
  const { rootPath, chatsPath } = await ensureDirectories();
  const indexPath = path.join(rootPath, "index.md");

  const indexContent: string[] = ["# Cursor Chat History\n"];
  indexContent.push("Click on the chat items below to view details.\n");

  for (const composerBody of composerBodyData) {
    if (composerBody.conversation.length === 0) {
      continue;
    }

    const chatTitle = composerBody.name || "Untitled Chat";
    const chatFileName = `${composerBody.composerId}.md`;

    indexContent.push(`- [${chatTitle}](chats/${chatFileName})`);
    indexContent.push(`  *(${formatDate(new Date(composerBody.createdAt))})*`);
    indexContent.push("");

    const chatContent: string[] = [];
    chatContent.push(`# ${chatTitle}\n`);
    if (composerBody.lastUpdatedAt) {
      chatContent.push(`**Last Conversation**: ${formatDate(new Date(composerBody.lastUpdatedAt))}\n`);
    }
    chatContent.push(`[Back to Index](../index.md)\n`);

    composerBody.conversation.forEach((conversation) => {
      chatContent.push(conversationToMarkdown(conversation));
      chatContent.push("\n");
    });

    await fs.writeFile(path.join(chatsPath, chatFileName), chatContent.join("\n"));
  }

  await fs.writeFile(indexPath, indexContent.join("\n"));
}

async function ensureDirectories(): Promise<{ rootPath: string; chatsPath: string }> {
  const rootPath = path.join(getProjectPath(), "cursor-chats");
  const chatsPath = path.join(rootPath, "chats");

  await fs.mkdir(rootPath, { recursive: true });
  await fs.mkdir(chatsPath, { recursive: true });

  return { rootPath, chatsPath };
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

function conversationToMarkdown(conversation: ComposerConversation): string {
  const parts: string[] = [];
  parts.push(`<!-- Bubble ID: ${conversation.bubbleId} -->`);
  const author = conversation.type === 1 ? "👤 User" : `🤖 AI`;
  parts.push(`**${author}**\n`);

  if (conversation.text) {
    parts.push(`${conversation.text}\n`);
  }

  if (conversation.context) {
    const { cursorRules, externalLinks, fileSelections, folderSelections, selectedCommits, selectedDocs, selections, terminalSelections } = conversation.context;

    if (cursorRules.length > 0) {
      parts.push("**Cursor Rules:**\n");
      cursorRules.forEach((rule) => {
        parts.push(`- ${rule.filename}\n`);
      });
    }

    if (externalLinks.length > 0) {
      parts.push("**External Links:**\n");
      externalLinks.forEach((link) => {
        parts.push(`- ${link.url}\n`);
      });
    }

    if (fileSelections.length > 0) {
      parts.push("**File Selections:**\n");
      fileSelections.forEach((selection) => {
        parts.push(`- ${selection.uri.path}\n`);
      });
    }

    if (folderSelections.length > 0) {
      parts.push("**Folder Selections:**\n");
      folderSelections.forEach((selection) => {
        parts.push(`- ${selection.relativePath}\n`);
      });
    }

    if (selectedCommits.length > 0) {
      parts.push("**Selected Commits:**\n");
      selectedCommits.forEach((commit) => {
        parts.push(`- ${commit.message}\n`);
      });
    }

    if (selectedDocs.length > 0) {
      parts.push("**Selected Docs:**\n");
      selectedDocs.forEach((doc) => {
        parts.push(`- ${doc.name} (${doc.url})\n`);
      });
    }

    if (selections.length > 0) {
      parts.push("**Selections:**\n");
      selections.forEach((selection) => {
        const lineCount = selection.text.split("\n").length;
        const location = selection.uri ?
          `${path.basename(selection.uri.path)} (${selection.range.selectionStartLineNumber}-${selection.range.selectionStartLineNumber + lineCount})` :
          'Unknown location';
        parts.push(`- ${location}\n`);
        parts.push(`${selection.text}\n`);
      });
    }

    if (terminalSelections.length > 0) {
      parts.push("**Terminal Selections:**\n");
      terminalSelections.forEach((selection) => {
        const lineCount = selection.text.split("\n").length;
        const location = `Terminal (${selection.range.selectionStartLineNumber}-${selection.range.selectionStartLineNumber + lineCount})`;
        parts.push(`- ${location}\n`);
        parts.push(`${selection.text}\n`);
      });
    }
  }

  return parts.join("\n");
}