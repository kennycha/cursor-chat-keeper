# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Cursor Chat Keeper is a VSCode extension that extracts and saves Cursor chat history as organized markdown files. The extension reads from Cursor's SQLite database files and converts conversation data into readable markdown format.

## Architecture

The extension consists of three main TypeScript files:

- `src/extension.ts` - VSCode extension entry point, registers the `cursor-chat-keeper.collectChats` command
- `src/utils.ts` - Core functionality for database queries, data processing, and markdown generation
- `src/types.ts` - TypeScript interfaces for Cursor's chat data structures

### Key Components

**Database Access Pattern:**
- Workspace database (`workspaceStorage/{id}/state.vscdb`) - stores composer metadata
- Global database (`globalStorage/state.vscdb`) - stores actual chat conversation data
- Uses `@vscode/sqlite3` for database operations

**Data Flow:**
1. Extract workspace ID from VSCode extension context
2. Query workspace database for composer IDs
3. Query global database for conversation data using composer IDs
4. Transform data and generate markdown files in `cursor-chats/` directory

## Development Commands

### Build and Package
```bash
pnpm run compile          # Compile TypeScript to JavaScript
pnpm run watch           # Watch mode compilation
pnpm run package         # Production build with webpack
pnpm run vscode:prepublish  # Prepare for publishing
```

### Testing and Quality
```bash
pnpm run lint            # ESLint code checking
pnpm run test            # Run VSCode extension tests
pnpm run pretest         # Compile tests, compile, and lint
pnpm run compile-tests   # Compile test files
pnpm run watch-tests     # Watch mode for test compilation
```

## Dependencies

**Runtime:**
- `@vscode/sqlite3` - SQLite database access for reading Cursor's chat data

**Development:**
- TypeScript with strict mode enabled
- Webpack for bundling
- ESLint for code quality
- VSCode test framework for extension testing

## Platform Support

The extension supports cross-platform Cursor database paths:
- **macOS**: `~/Library/Application Support/Cursor/User`
- **Windows**: `~\AppData\Roaming\Cursor\User`  
- **Linux**: `~/.config/Cursor/User`

## Output Structure

Generated files are saved to `cursor-chats/` in the workspace root:
- `index.md` - Main index with links to all chat conversations
- `chats/{composerId}.md` - Individual chat conversation files

Each chat file includes conversation bubbles with metadata (bubble IDs), context information (file selections, external links, etc.), and properly formatted user/AI exchanges.