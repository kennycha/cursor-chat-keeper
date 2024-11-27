# Cursor Chat Keeper

VSCode extension that saves your Cursor chat history as a markdown file. This extension helps you keep track of your AI conversations in Cursor editor by automatically formatting and organizing them into a readable markdown document.

> ## Features

- Saves Cursor chat history to a markdown file (`cursor-chat.md`)

> ## Requirements

- Cursor Editor installed
- VSCode 1.74.0 or higher
- Active workspace (folder) opened in VSCode
- The extension reads chat history from Cursor's database file, which is located at:

  - Windows: `~\APPDATA\Roaming\Cursor`
  - macOS: `~/Library/Application Support/Cursor`
  - Linux: `~/.config/Cursor`

> ## Installation

1. Open Cursor
2. Go to Extensions (Ctrl+Shift+X or Cmd+Shift+X on Mac)
3. Search for "Cursor Chat Keeper"
4. Click Install

> ## Usage

### Command Palette

1. Open Command Palette (Ctrl+Shift+P or Cmd+Shift+P on Mac)
2. Type "Save Cursor Chat History"
3. Press Enter

The extension will create (or update) a `cursor-chat.md` file in your workspace root directory.

### Keyboard Shortcuts

Default keyboard shortcut: `Ctrl+Alt+C`

You can customize this shortcut in Cursor:

1. Open Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P` on Mac)
2. Type "Preferences: Open Keyboard Shortcuts"
3. Search for "Collect Chats from Cursor"
4. Click the plus icon to add or modify the shortcut

Make sure you have Cursor installed and have used the chat feature at least once before using this extension.

> ## Output Example

The markdown file will be organized as follows:

<!-- Tab ID: 9b848242-5cea-4909-8f88-ea179886c41b -->

## Using VSCode Extensions in Cursor Editor

**Last Send Time**: 2024/11/27 22:40:28

<!-- Bubble ID: 050e847d-ac73-4923-acaf-25372483b851 -->

**👤 User**

How can I use vscode extension in cursor editor?

<!-- Bubble ID: c798588c-07a1-4216-be7b-82377d685033 -->

**🤖 AI (claude-3.5-sonnet)**

Cursor Editor actually has built-in support for most VS Code extensions, but there are a few steps to use them:

1. Open Cursor's Extension Manager:

   - Use `Cmd+Shift+X` (Mac) or `Ctrl+Shift+X` (Windows/Linux)
   - Or click the Extensions icon in the left sidebar

2. Install extensions:
   - Search for the VS Code extension you want
   - Click "Install" on the extension you want to use

Important notes:

- Not all VS Code extensions are compatible with Cursor
- Some popular extensions that work well:
  - GitLens
  - Prettier
  - ESLint
  - Color themes
  - Language support extensions

If you find an extension that doesn't work properly in Cursor, you can:

1. Check if there's a Cursor-specific alternative
2. Report the compatibility issue to Cursor's team
3. Use VS Code for that specific functionality

Remember that Cursor is built on top of VS Code's core, but it's not a complete 1:1 match, so some extensions might behave differently or not work at all.

<!-- Bubble ID: af975c09-910e-4642-9daf-0987ce086b3a -->

**👤 User**

Thank you!
