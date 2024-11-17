export interface ChatData {
  tabs: Tab[];
}

export interface Tab {
  tabId: string;
  chatTitle: string;
  tabState: 'chat';
  bubbles: Bubble[];
  lastSendTime: number;
}

export interface Bubble {
  id: string;
  type: 'user' | 'ai';
  notepads: Notepad[];
  selections: Selection[];
  fileSelections: FileSelection[];
  folderSelections: FolderSelection[];
  text: string;
  modelType?: string;
}

export interface Notepad {
  text: string;
}

export interface Selection {
  text: string,
  range: {
    selectionStartLineNumber: 36,
    selectionStartColumn: 1,
    positionLineNumber: 88,
    positionColumn: 4
  },
  uri: {
    path: string;
    scheme: string;
  };
}

export interface FileSelection {
  uri: {
    path: string;
    scheme: string;
  };
}

export interface FolderSelection {
  uri: {
    path: string;
    scheme: string;
  };
}

export interface TabContent {
  content: string;
  bubbles: Set<string>;
  lastPosition: number;
}

export interface ParsedContent {
  tabs: Map<string, TabContent>;
}