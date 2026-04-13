// FILENAME: types.ts - VERSION: v18 (Group Element)
// Updated to v11 with 'regenerateSummary' action button type and GroundingMetadata.
// Updated to v12 to make WebChunk.uri optional to match Gemini API.
// Updated to v13 to add mermaidSyntax to ImageElement and editMermaid action.
// Updated to v14 to define and export GeminiResponse.
// Updated to v15 to add ZoomState for session saving/loading.
// Updated to v16 to introduce Command interface for Undo/Redo pattern.
// Updated to v17 to add UrlElement and URL tool.
// Updated to v18 to add GroupElement and groupId to elements.

export interface Command {
  execute: () => void;
  undo: () => void;
  // Optional: redo could simply be execute, or more specific if needed
  // redo?: () => void;
}


export enum Tool {
  PENCIL = 'PENCIL',
  ERASER = 'ERASER',
  TEXT = 'TEXT',
  URL = 'URL',
  // Old Flowchart tools - will be part of Shapes
  RECTANGLE = 'RECTANGLE',
  OVAL = 'OVAL',
  DIAMOND = 'DIAMOND',
  ARROW = 'ARROW',
  // New Shapes
  TRIANGLE = 'TRIANGLE',
  PARALLELOGRAM = 'PARALLELOGRAM',
  HEXAGON = 'HEXAGON',
  CYLINDER = 'CYLINDER',
  CLOUD = 'CLOUD',
  STAR = 'STAR',
  // Interaction tool
  SELECT = 'SELECT',
  EMOJI_STAMP = 'EMOJI_STAMP',
  PAN = 'PAN', 
  CONTENT_BOX = 'CONTENT_BOX',
  GROUP = 'GROUP', // Placeholder, grouping is more of an action
}

export interface Point {
  x: number;
  y: number;
}

export interface PathElement {
  id: string;
  type: 'path';
  points: Point[]; // Virtual coordinates
  color: string;
  strokeWidth: number;
  aiSummary?: string;
  aiSummaryVisible?: boolean;
  aiSummaryLoading?: boolean;
  groupId?: string; 
}

export interface TextElement {
  id:string;
  type: 'text';
  x: number; // Virtual coordinate
  y: number; // Virtual coordinate
  text: string;
  color: string;
  font: string; // e.g., "16px Arial"
  aiSummary?: string;
  aiSummaryVisible?: boolean;
  aiSummaryLoading?: boolean;
  groupId?: string; 
}

export interface UrlElement {
  id: string;
  type: 'url';
  x: number; // Virtual coordinate
  y: number; // Virtual coordinate
  urlText: string; // The actual URL
  displayText?: string; // Optional text to display instead of the raw URL
  color: string;
  fontSize: number; // Virtual units
  fontFamily: string;
  aiSummary?: string;
  aiSummaryVisible?: boolean;
  aiSummaryLoading?: boolean;
  groupId?: string; 
}

export type ShapeType =
  | 'rectangle'
  | 'oval'
  | 'diamond'
  | 'triangle'
  | 'parallelogram'
  | 'hexagon'
  | 'cylinder'
  | 'cloud'
  | 'star';

export const SHAPE_TYPE_VALUES: ShapeType[] = [
  'rectangle', 'oval', 'diamond', 'triangle', 'parallelogram',
  'hexagon', 'cylinder', 'cloud', 'star'
];

export interface FlowchartShapeElement {
  id: string;
  type: 'flowchart-shape';
  shapeType: ShapeType;
  x: number; // Virtual top-left
  y: number; // Virtual top-left
  width: number;
  height: number;
  text: string;
  fillColor: string;
  borderColor: string;
  strokeWidth: number;
  textColor: string; // Automatically determined for contrast
  aiSummary?: string;
  aiSummaryVisible?: boolean;
  aiSummaryLoading?: boolean;
  groupId?: string; 
}

export type LineStyle = 'arrow' | 'plain' | 'dotted'; // Added 'dotted'

export interface ConnectorElement {
  id: string;
  type: 'connector';
  startPoint: Point; // Virtual coordinates
  endPoint: Point; // Virtual coordinates
  color: string;
  strokeWidth: number;
  lineStyle?: LineStyle; // Updated
  startElementId?: string; // Optional ID of the element the connector starts from
  startAttachmentPointIndex?: number; // Optional index of the attachment point on the start element
  endElementId?: string; // Optional ID of the element the connector ends at
  endAttachmentPointIndex?: number; // Optional index of the attachment point on the end element
  // Connectors are typically not part of a group directly, but can connect to groups.
}

export interface ImageElement {
  id: string;
  type: 'image';
  src: string; // Data URL
  x: number; // Virtual coordinate
  y: number; // Virtual coordinate
  width: number; // Display width
  height: number; // Display height
  naturalWidth: number; // Original image width
  naturalHeight: number; // Original image height
  aiSummary?: string;
  aiSummaryVisible?: boolean;
  aiSummaryLoading?: boolean;
  mermaidSyntax?: string; 
  groupId?: string; 
}

export interface EmojiElement {
  id:string;
  type: 'emoji';
  emojiChar: string;
  x: number; // Virtual top-left for drawing with fillText
  y: number; // Virtual top-left for drawing with fillText
  size: number; // font size, determines visual size
  aiSummary?: string;
  aiSummaryVisible?: boolean;
  aiSummaryLoading?: boolean;
  groupId?: string; 
}

export type ContentType = 'plaintext' | 'markdown' | 'javascript' | 'python' | 'html' | 'css' | 'json';

export interface ContentBoxElement {
  id: string;
  type: 'content-box';
  x: number;
  y: number;
  width: number;
  height: number;
  contentType: ContentType;
  filename?: string;
  content: string;
  backgroundColor: string;
  textColor: string;
  fontSize: number; // font size for the content text
  aiSummary?: string;
  aiSummaryVisible?: boolean;
  aiSummaryLoading?: boolean;
  groupId?: string; 
}

export interface GroupElement {
  id: string;
  type: 'group';
  childElementIds: string[];
  x: number; // Bounding box virtual top-left
  y: number; // Bounding box virtual top-left
  width: number; // Bounding box virtual width
  height: number; // Bounding box virtual height
  aiSummary?: string;
  aiSummaryVisible?: boolean;
  aiSummaryLoading?: boolean;
  // Groups cannot be part of other groups in V1
}


export type WhiteboardElement =
  | PathElement
  | TextElement
  | FlowchartShapeElement
  | ConnectorElement
  | ImageElement
  | EmojiElement
  | ContentBoxElement
  | UrlElement
  | GroupElement; // Added GroupElement

// Types for AI interaction

interface AiBaseCommand {
  type: string;
}

interface AiPathCommand extends AiBaseCommand {
  type: 'path';
  points: Point[];
  color: string;
  strokeWidth: number;
}

export interface AiTextCommand extends AiBaseCommand {
  type: 'text';
  x: number;
  y: number;
  content: string; // Renamed from text
  textColor: string; // Renamed from color
  fontSize?: number; // Changed from font: string
  width?: number; // Optional width for the text box
  height?: number; // Optional height for the text box
  backgroundColor?: string; // Optional background color for the text box
}

export interface AiUrlCommand extends AiBaseCommand {
  type: 'url';
  x: number;
  y: number;
  urlText: string;
  displayText?: string;
  textColor?: string;
  fontSize?: number;
}

export interface AiFlowchartShapeCommand extends AiBaseCommand {
  type: 'flowchart-shape';
  shapeType: ShapeType;
  x: number; // top-left corner
  y: number; // top-left corner
  width: number;
  height: number;
  text?: string; // Text inside the shape
  fillColor: string; // Hex color for fill or "transparent"
  borderColor?: string; // Optional, hex color for border
  strokeWidth?: number; // Optional
}

export interface AiConnectorCommand extends AiBaseCommand {
  type: 'connector';
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  color: string; // Hex color
  strokeWidth?: number; // Optional
  lineStyle?: LineStyle; 
}

export interface TargetElementDescription {
  id?: string;
  shapeType?: ShapeType;
  textContains?: string;
  color?: string; // Hex fill color for shapes, or general color for text/paths
  isGroup?: boolean; // To target groups specifically
}

export interface AiModifyElementCommand extends AiBaseCommand {
  type: 'modify-element';
  target: TargetElementDescription;
  modifications: {
    select?: boolean;
    newX?: number;
    newY?: number;
    deltaX?: number;
    deltaY?: number;
    newWidth?: number;
    newHeight?: number;
  };
}

// AI command for grouping/ungrouping might be complex for AI to generate initially.
// For now, these actions will be user-driven. If AI needs to group/ungroup, it would target elements
// and then the user would perform the action, or AI would describe the elements to group.

export type AiDrawingCommand =
  | AiPathCommand
  | AiTextCommand
  | AiFlowchartShapeCommand
  | AiConnectorCommand
  | AiModifyElementCommand
  | AiUrlCommand;

// Grounding types
export interface WebChunk {
  uri?: string; 
  title?: string;
}

export interface GroundingChunk {
  web?: WebChunk;
  searchResult?: WebChunk;
}

export interface GroundingMetadata {
  groundingChunks?: GroundingChunk[];
}

export type ResizeHandleType = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
export interface ResizeHandle {
  type: ResizeHandleType;
  x: number;
  y: number;
  width: number;
  height: number;
  cursor: string;
}

export type AiPersona =
  | 'helpful-assistant'
  | 'mindless-robot'
  | 'architect'
  | 'artist'
  | 'creative-designer';

export interface AiPersonaOption {
  id: AiPersona;
  name: string;
  description: string;
}
export interface ElementSummaryActionButton {
  type: 'regenerateSummary' | 'showSummary' | 'hideSummary' | 'loadingSummary' | 'editMermaid'; 
  x: number; // viewport coordinates
  y: number; // viewport coordinates
  width: number;
  height: number;
  icon: (ctx: CanvasRenderingContext2D, x: number, y: number, size: number) => void; 
}

export interface AiResponse {
  analysisText?: string;
  drawings?: AiDrawingCommand[];
  error?: string;
  groundingMetadata?: GroundingMetadata;
}

export type ZoomState = {
  level: number;
}

export type AiProvider = 'gemini' | 'ollama' | 'lm-studio';

export interface AiConfig {
  provider: AiProvider;
  localAiBaseUrl: string;
  localAiModel: string;
}
