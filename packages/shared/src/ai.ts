export type DiagramType = 'flowchart' | 'mindmap' | 'process';

export interface AISummarizeResponse {
  summary: string;
}

export interface AIAskRequest {
  question: string;
}

export interface AIAskResponse {
  answer: string;
}

export interface AISuggestResponse {
  suggestions: string[];
}

export interface AIGenerateDiagramRequest {
  prompt: string;
  diagramType?: DiagramType;
}

export interface AIDiagramNode {
  id: string;
  label: string;
}

export interface AIDiagramEdge {
  from: string;
  to: string;
  label?: string;
}

export interface AIGenerateDiagramResponse {
  diagramType: DiagramType;
  nodes: AIDiagramNode[];
  edges: AIDiagramEdge[];
}
