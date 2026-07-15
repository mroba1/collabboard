export type BoardObjectType =
  | 'rectangle'
  | 'ellipse'
  | 'arrow'
  | 'path'
  | 'text'
  | 'sticky'
  | 'image'
  | 'shape';

// Polygon-family shapes rendered through one generic path (see ShapeObject)
// instead of a dedicated object type per shape, so adding a new one is a
// rendering-branch change, not a new type/migration every time.
export type ShapeKind = 'triangle' | 'diamond' | 'pentagon' | 'hexagon' | 'star' | 'polygon';

// Freehand/line-family stroke rendering variants, sharing one PathObject
// shape so brush/highlighter/line are styling differences, not new types.
export type PathVariant = 'pen' | 'brush' | 'highlighter' | 'line';

export type BoardRole = 'OWNER' | 'EDITOR' | 'VIEWER';

export interface BoardObjectBase {
  id: string;
  boardId: string;
  type: BoardObjectType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  fill?: string | null;
  stroke?: string | null;
  strokeWidth?: number | null;
  opacity?: number | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface RectangleObject extends BoardObjectBase {
  type: 'rectangle';
  cornerRadius?: number;
}

export interface EllipseObject extends BoardObjectBase {
  type: 'ellipse';
}

export interface ArrowObject extends BoardObjectBase {
  type: 'arrow';
  points: number[];
  curved?: boolean;
  /** Object IDs this connector snaps to, if created with the Connector tool. Purely informational -- endpoints are baked into `points` at creation time and do not live-follow if the connected shapes move. */
  connectorFrom?: string;
  connectorTo?: string;
}

export interface PathObject extends BoardObjectBase {
  type: 'path';
  points: number[];
  variant?: PathVariant;
}

export interface ShapeObject extends BoardObjectBase {
  type: 'shape';
  shapeKind: ShapeKind;
  /** Number of sides for shapeKind: 'polygon' (default 5). Ignored otherwise. */
  sides?: number;
}

export interface TextObject extends BoardObjectBase {
  type: 'text';
  text: string;
  fontSize: number;
  fontFamily?: string;
  align?: 'left' | 'center' | 'right';
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}

export interface StickyObject extends BoardObjectBase {
  type: 'sticky';
  text: string;
  color: string;
  fontSize?: number;
  align?: 'left' | 'center' | 'right';
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  textColor?: string;
}

export interface ImageObject extends BoardObjectBase {
  type: 'image';
  src: string;
}

export type BoardObject =
  | RectangleObject
  | EllipseObject
  | ArrowObject
  | PathObject
  | ShapeObject
  | TextObject
  | StickyObject
  | ImageObject;

type OmitBase<T extends BoardObject> = Omit<
  T,
  'id' | 'boardId' | 'createdBy' | 'createdAt' | 'updatedAt' | 'zIndex'
> & { id?: string; zIndex?: number };

// Distributes over each member of the BoardObject union individually so
// type-specific fields (points, text, src, ...) survive instead of being
// collapsed to their common intersection.
export type CreateBoardObjectInput = BoardObject extends infer T
  ? T extends BoardObject
    ? OmitBase<T>
    : never
  : never;

export interface BoardMemberInfo {
  userId: string;
  name: string;
  email: string;
  color: string;
  role: BoardRole;
}

export interface BoardSummary {
  id: string;
  name: string;
  color: string;
  isFavorite: boolean;
  role: BoardRole;
  members: BoardMemberInfo[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateBoardRequest {
  name: string;
  color?: string;
}

export interface UpdateBoardRequest {
  name?: string;
  isFavorite?: boolean;
}

export interface InviteMemberRequest {
  email: string;
  role?: BoardRole;
}
