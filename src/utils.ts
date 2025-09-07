import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";
import { ComposerBodyDatum, ComposerConversation, ComposerData } from "./types";

const DB_CONSTANTS = {
  WORKSPACE_DB: "state.vscdb",
  GLOBAL_DB: "state.vscdb",
  COMPOSER_DATA_KEY: "composer.composerData",
  COMPOSER_DATA_PREFIX: "composerData:",
  WORKSPACE_STORAGE: "workspaceStorage",
  GLOBAL_STORAGE: "globalStorage",
} as const;

const CURSOR_PATHS = {
  darwin: path.join("Library", "Application Support", "Cursor", "User"),
  win32: path.join("AppData", "Roaming", "Cursor", "User"),
  linux: path.join(".config", "Cursor", "User"),
} as const;

export async function collectAndSaveChats(
  context: vscode.ExtensionContext, 
  progress?: vscode.Progress<{ message?: string; increment?: number }>
): Promise<string> {
  if (!context.storageUri) {
    throw new Error("Storage URI not found");
  }

  progress?.report({ message: "Loading SQLite module..." });
  let sqlite: typeof import("@vscode/sqlite3");
  try {
    sqlite = await import("@vscode/sqlite3");
  } catch (error) {
    throw new Error(`Failed to load SQLite module. Please ensure you're running in a compatible environment: ${error}`);
  }

  const basePath = getBasePath();
  const currentWorkspaceId = getCurrentWorkspaceId(context.storageUri.fsPath);
  const workspaceDbPath = path.join(basePath, DB_CONSTANTS.WORKSPACE_STORAGE, currentWorkspaceId, DB_CONSTANTS.WORKSPACE_DB);

  await validateDatabasePath(workspaceDbPath);

  try {
    progress?.report({ message: "Reading workspace database..." });
    const db = await initDatabase(workspaceDbPath, sqlite);
    const composerData = await queryComposerData(db);
    await terminateDatabase(db);

    if (!composerData) {
      return "No composer data found";
    }

    progress?.report({ message: "Reading global database..." });
    const globalDbPath = path.join(basePath, DB_CONSTANTS.GLOBAL_STORAGE, DB_CONSTANTS.GLOBAL_DB);
    await validateDatabasePath(globalDbPath);
    const globalDb = await initDatabase(globalDbPath, sqlite);
    const keys = composerData.allComposers.map(({ composerId }) => `${DB_CONSTANTS.COMPOSER_DATA_PREFIX}${composerId}`);
    const placeHolders = keys.map(() => "?").join(",");
    const composerBodyData = await queryComposerBodyData(globalDb, keys, placeHolders);
    await terminateDatabase(globalDb);
    const sorted = composerBodyData.toSorted((a, b) => b.createdAt - a.createdAt);
    progress?.report({ message: "Generating markdown files..." });
    const outputPath = await composerBodyDataToMarkdown(sorted, progress);
    
    return `Successfully collected and saved chats to: ${outputPath}`;

  } catch (error) {
    throw new Error(`Failed to collect chats: ${error}`);
  }
}

function getCurrentWorkspaceId(storagePath: string): string {
  return path.basename(path.dirname(storagePath));
}

function getBasePath(): string {
  const platform = process.platform as keyof typeof CURSOR_PATHS;
  const platformPath = CURSOR_PATHS[platform];
  
  if (!platformPath) {
    throw new Error(`Unsupported platform: ${process.platform}. Supported platforms: ${Object.keys(CURSOR_PATHS).join(', ')}`);
  }
  
  return path.join(os.homedir(), platformPath);
}

async function validateDatabasePath(dbPath: string): Promise<void> {
  try {
    await fs.access(dbPath, fs.constants.F_OK);
  } catch (error) {
    throw new Error(`Database file not found: ${dbPath}. Please ensure Cursor is installed and has been used at least once.`);
  }
}

function getProjectPath(): string {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    throw new Error("No workspace found.");
  }
  return workspaceFolders[0].uri.fsPath;
}

async function initDatabase(dbPath: string, sqlite: typeof import("@vscode/sqlite3")): Promise<InstanceType<typeof sqlite.Database>> {
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

async function terminateDatabase(db: InstanceType<typeof import("@vscode/sqlite3").Database>): Promise<void> {
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

async function queryComposerData(db: InstanceType<typeof import("@vscode/sqlite3").Database>): Promise<ComposerData> {
  return new Promise((resolve, reject) => {
    db.get(
      `
    SELECT value FROM ItemTable 
    WHERE [key] = (?)
  `,
      [DB_CONSTANTS.COMPOSER_DATA_KEY],
      (error, row) => {
        if (error) {
          reject(error);
        } else if (!row) {
          reject(new Error("No composer data found in database"));
        } else {
          try {
            const composerData: ComposerData = JSON.parse((row as { value: string }).value);
            resolve(composerData);
          } catch (parseError) {
            reject(new Error(`Failed to parse composer data: ${parseError}`));
          }
        }
      }
    );
  });
}

async function queryComposerBodyData(db: InstanceType<typeof import("@vscode/sqlite3").Database>, keys: string[], placeHolders: string): Promise<ComposerBodyDatum[]> {
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
          try {
            const composerBodyData: ComposerBodyDatum[] = rows.map((row) => JSON.parse((row as { value: string }).value));
            resolve(composerBodyData);
          } catch (parseError) {
            reject(new Error(`Failed to parse composer body data: ${parseError}`));
          }
        }
      }
    );
  });
}

async function composerBodyDataToMarkdown(
  composerBodyData: ComposerBodyDatum[], 
  progress?: vscode.Progress<{ message?: string; increment?: number }>
): Promise<string> {
  const { rootPath, chatsPath } = await ensureDirectories();
  const indexPath = path.join(rootPath, "index.md");

  const indexContent: string[] = ["# Cursor Chat History\n"];
  indexContent.push("Click on the chat items below to view details.\n");

  const total = composerBodyData.length;
  for (let i = 0; i < total; i++) {
    const composerBody = composerBodyData[i];
    progress?.report({ 
      message: `Processing chat ${i + 1} of ${total}: ${composerBody.name || 'Untitled Chat'}` 
    });
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

    composerBody.conversation?.forEach((conversation) => {
      chatContent.push(conversationToMarkdown(conversation));
      chatContent.push("\n");
    });

    await fs.writeFile(path.join(chatsPath, chatFileName), chatContent.join("\n"));
  }

  await fs.writeFile(indexPath, indexContent.join("\n"));
  return rootPath;
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

    if (cursorRules && cursorRules.length > 0) {
      parts.push("**Cursor Rules:**\n");
      cursorRules.forEach((rule) => {
        parts.push(`- ${rule.filename}\n`);
      });
    }

    if (externalLinks && externalLinks.length > 0) {
      parts.push("**External Links:**\n");
      externalLinks.forEach((link) => {
        parts.push(`- ${link.url}\n`);
      });
    }

    if (fileSelections && fileSelections.length > 0) {
      parts.push("**File Selections:**\n");
      fileSelections.forEach((selection) => {
        parts.push(`- ${selection.uri.path}\n`);
      });
    }

    if (folderSelections && folderSelections.length > 0) {
      parts.push("**Folder Selections:**\n");
      folderSelections.forEach((selection) => {
        parts.push(`- ${selection.relativePath}\n`);
      });
    }

    if (selectedCommits && selectedCommits.length > 0) {
      parts.push("**Selected Commits:**\n");
      selectedCommits.forEach((commit) => {
        parts.push(`- ${commit.message}\n`);
      });
    }

    if (selectedDocs && selectedDocs.length > 0) {
      parts.push("**Selected Docs:**\n");
      selectedDocs.forEach((doc) => {
        parts.push(`- ${doc.name} (${doc.url})\n`);
      });
    }

    if (selections && selections.length > 0) {
      parts.push("**Selections:**\n");
      selections.forEach((selection) => {
        const location = selection.uri ?
          `${path.basename(selection.uri.path)} (${selection.range.selectionStartLineNumber}-${selection.range.positionLineNumber})` :
          'Unknown location';
        parts.push(`- ${location}\n`);
        parts.push(`${selection.text}\n`);
      });
    }

    if (terminalSelections && terminalSelections.length > 0) {
      parts.push("**Terminal Selections:**\n");
      terminalSelections.forEach((selection) => {
        const location = `Terminal (${selection.range.selectionStartLineNumber}-${selection.range.positionLineNumber})`;
        parts.push(`- ${location}\n`);
        parts.push(`${selection.text}\n`);
      });
    }
  }

  return parts.join("\n");
}