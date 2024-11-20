# Cursor Chat Keeper

VSCode extension that saves your Cursor chat history as a markdown file. This extension helps you keep track of your AI conversations in Cursor editor by automatically formatting and organizing them into a readable markdown document.

## Features

- 💾 Saves Cursor chat history to a markdown file (`cursor-chat.md`)

## Requirements

- VSCode 1.86.0 or higher
- Cursor Editor installed
- Active workspace (folder) opened in VSCode

## Installation

1. Open VSCode
2. Go to Extensions (Ctrl+Shift+X or Cmd+Shift+X on Mac)
3. Search for "Cursor Chat Keeper"
4. Click Install

## Usage

### Command Palette

1. Open Command Palette (Ctrl+Shift+P or Cmd+Shift+P on Mac)
2. Type "Save Cursor Chat History"
3. Press Enter

The extension will create (or update) a `cursor-chat.md` file in your workspace root directory.

### Keyboard Shortcuts

Default keyboard shortcut: `Ctrl+Alt+C`

You can customize this shortcut in VSCode:

1. Open Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P` on Mac)
2. Type "Preferences: Open Keyboard Shortcuts"
3. Search for "Collect Chats from Cursor"
4. Click the plus icon to add or modify the shortcut

### Cursor Database Location

The extension reads chat history from Cursor's database file, which is located at:

- Windows: `~\APPDATA\Roaming\Cursor`
- macOS: `~/Library/Application Support/Cursor`
- Linux: `~/.config/Cursor`

Make sure you have Cursor installed and have used the chat feature at least once before using this extension.

### Output Format(WIP)

The markdown file will be organized as follows:
