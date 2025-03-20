export interface ComposerBodyDatum {
  codeBlockData: {
    [filePath: string]: CodeBlockDatum[]
  }
  composerId: string;
  context: ComposerContext;
  conversation: ComposerConversation[];
  createdAt: number;
  lastUpdatedAt: number;
  name: string;
  unifiedMode: 'chat' | 'edit';
}

export interface CodeBlockDatum {
  uri: Uri;
  content: string;
  languageId: string;
}

export interface ComposerConversation {
  bubbleId: string;
  // type이 1 일때만 존재
  context?: ComposerContext;
  codeBlocks: {
    codeBlockIdx: number;
  }[]
  text: string;
  // 1: user, 2: ai
  type: 1 | 2
  relevantFiles: string[];
}

export interface ComposerContext {
  composers: {
    composerId: string
  }[]
  cursorRules: {
    filename: string;
  }[]
  externalLinks: string[];
  fileSelections: {
    uri: Uri;
  }[];
  folderSelections: {
    relativePath: string;
  }[];
  notepads: {
    nodepadId: string;
  }[];
  selectedCommits: {
    message: string;
    sha: string;
  }
  selectedDocs: {
    docId: string;
    name: string;
    url: string;
  }[]
  selections: {
    range: Range
    text: string;
    uri: Uri;
  }[];
  terminalSelections: {
    range: Range;
    text: string;
  }[];
}

export interface Uri {
  path: string;
  scheme: string;
}

export interface Range {
  positionColumn: number;
  positionLineNumber: number;
  selectionStartColumn: number;
  selectionStartLineNumber: number;
}
