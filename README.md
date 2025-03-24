# Cursor Chat Keeper

Cursor extension that saves your Cursor chat history as a markdown file. This extension helps you keep track of your AI conversations in Cursor editor by automatically formatting and organizing them into a readable markdown document.

> ## Features

- Saves Cursor chat history to a markdown file (`cursor-chat.md`)

> ## Requirements

- Cursor Editor installed
- VSCode 1.74.0 or higher
- Active workspace (folder) opened in Cursor
- The extension reads chat history from Cursor's database file, which is located at:

  - Windows: `~\APPDATA\Roaming\Cursor`
  - macOS: `~/Library/Application Support/Cursor`
  - Linux: `~/.config/Cursor`

> ## Installation

1. Open Cursor
2. Go to Extensions (Ctrl+Shift+X or Cmd+Shift+X on Mac)
3. Search for "Cursor Chat Keeper"
4. Click Install

or

Follow the steps according to the Cursor Docs[(How to Install Any VSCode Extension in Cursor)](https://www.cursor.com/how-to-install-extension):

1. Go to [Marketplace | Cursor Chat Keeper](https://marketplace.visualstudio.com/items?itemName=kennycha.cursor-chat-keeper)
2. Click Download Extension on the right side
3. Open Cursor and go to Extensions Pane
4. Drag the downloaded file into the Extensions Pane

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

# Impact of Removing React StrictMode

**Last Conversation**: 2025/03/24 21:03:54

[Back to Index](.)

<!-- Bubble ID: 3d5a7752-fad2-4f96-8612-693b560ff193 -->

**👤 User**

@https://react.dev/reference/react

What happens if I remove React StrictMode?

**External Links:**

- https://react.dev/reference/react

**File Selections:**

- /Users/kenny/Desktop/sample-project/src/main.tsx

<!-- Bubble ID: de669b2c-90a1-4eac-9708-d5c1e76c1490 -->

**🤖 AI**

Based on the React documentation, removing StrictMode would remove React's development-time checks and warnings that help you identify potential problems in your application. Here are the key implications of removing StrictMode:

1. **Loss of Double-Rendering Detection**: StrictMode intentionally double-renders components in development to help detect side effects in rendering. Without it, you might miss bugs related to impure rendering.

2. **Missing Deprecation Warnings**: You won't get warnings about using deprecated React features or APIs that might break in future versions.

3. **Reduced Bug Detection**: StrictMode helps identify several common bugs by:
   - Detecting accidental side effects in render phase
   - Warning about legacy string refs
   - Warning about deprecated findDOMNode usage
   - Detecting unexpected side effects in constructor
   - Detecting legacy context API usage

Here's how your code would look without StrictMode:

```typescript:src/main.tsx
// ... existing code ...

ReactDOM.createRoot(document.getElementById("root")!).render(
  <App />
);
```

While your application will still work without StrictMode, it's generally recommended to keep it enabled, especially during development, as it helps maintain better code quality and catches potential issues early. StrictMode is a development-only feature and doesn't impact the production build, so there's usually no performance benefit to removing it.

[Source](https://react.dev/reference/react/StrictMode)
