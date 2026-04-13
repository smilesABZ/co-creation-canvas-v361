// FILENAME: src/features/canvas/canvasUtils.ts - VERSION: v15 (Basic Group Drawing)
// Updated to v10 to change AI summary buttons (remove generate, add regenerate).
// Updated to v11 to add "Edit Mermaid" button for relevant ImageElements.
// Updated to v12 to make drawing functions zoom-aware.
// Updated to v13 to add drawing logic for UrlElement.
// Updated to v14 to add stubs and considerations for GroupElement drawing.
// Updated to v15 for basic group element drawing (dashed box).

import {
  WhiteboardElement,
  PathElement,
  TextElement,
  FlowchartShapeElement,
  ImageElement,
  EmojiElement,
  ContentBoxElement,
  ConnectorElement,
  UrlElement, 
  GroupElement, 
  Point,
  ResizeHandle,
  ResizeHandleType,
  ShapeType,
  LineStyle,
  ElementSummaryActionButton,
} from '../../../types';
import {
    DEFAULT_FONT_SIZE, DEFAULT_FONT_FAMILY, TRANSPARENT_FILL_VALUE, HANDLE_SIZE,
    DEFAULT_CONTENT_BOX_FONT_SIZE, MIN_CONTENT_BOX_SIZE,
    CONNECTOR_HANDLE_RADIUS, CONNECTOR_HANDLE_FILL_COLOR, CONNECTOR_HANDLE_STROKE_COLOR, CONNECTOR_HANDLE_STROKE_WIDTH,
    CONNECTOR_SNAP_TARGET_RADIUS, CONNECTOR_SNAP_TARGET_FILL_COLOR, DEFAULT_LINE_STYLE,
    AI_SUMMARY_BUTTON_SIZE, AI_SUMMARY_BUTTON_PADDING, AI_SUMMARY_BUTTON_COLOR, AI_SUMMARY_LOADING_COLOR,
    AI_SUMMARY_TEXT_MAX_WIDTH, AI_SUMMARY_TEXT_PADDING, AI_SUMMARY_TEXT_FONT_SIZE, AI_SUMMARY_TEXT_LINE_HEIGHT,
    AI_SUMMARY_TEXT_COLOR, AI_SUMMARY_BACKGROUND_COLOR, AI_SUMMARY_BORDER_COLOR, AI_SUMMARY_OFFSET_X, AI_SUMMARY_OFFSET_Y, AI_SUMMARY_MARGIN_FROM_BUTTONS
} from '../../../constants';

// Helper to transform virtual coordinates to screen coordinates for drawing
const toScreen = (virtualPos: Point, viewBoxX: number, viewBoxY: number, zoomLevel: number): Point => ({
  x: (virtualPos.x - viewBoxX) * zoomLevel,
  y: (virtualPos.y - viewBoxY) * zoomLevel,
});

const drawRegenerateAISummaryIcon = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number) => {
    ctx.save();
    ctx.strokeStyle = AI_SUMMARY_BUTTON_COLOR;
    ctx.lineWidth = Math.max(1, size / 8);
    const s = size * 0.8;
    const centerX = x + size / 2;
    const centerY = y + size / 2;
    const radius = s / 2.5;

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, Math.PI * 0.2, Math.PI * 1.7);
    ctx.stroke();

    const angle = Math.PI * 1.75;
    ctx.beginPath();
    ctx.moveTo(centerX + Math.cos(angle) * radius, centerY + Math.sin(angle) * radius);
    ctx.lineTo(centerX + Math.cos(angle - 0.3) * (radius - Math.max(1, size*0.1)), centerY + Math.sin(angle - 0.3) * (radius - Math.max(1, size*0.1)));
    ctx.lineTo(centerX + Math.cos(angle + 0.3) * (radius - Math.max(1, size*0.1)), centerY + Math.sin(angle + 0.3) * (radius - Math.max(1, size*0.1)));
    ctx.closePath();
    ctx.fillStyle = AI_SUMMARY_BUTTON_COLOR;
    ctx.fill();
    ctx.restore();
};

const drawShowAISummaryIcon = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number) => {
  ctx.save();
  ctx.strokeStyle = AI_SUMMARY_BUTTON_COLOR;
  ctx.lineWidth = Math.max(1, size / 8);
  const s = size * 0.8;
  const offX = x + size * 0.1;
  const offY = y + size * 0.1;
  ctx.beginPath();
  ctx.ellipse(offX + s / 2, offY + s / 2, s / 2, s / 3.5, 0, 0, 2 * Math.PI);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(offX + s / 2, offY + s / 2, s / 6, 0, 2 * Math.PI);
  ctx.fillStyle = AI_SUMMARY_BUTTON_COLOR;
  ctx.fill();
  ctx.restore();
};

const drawHideAISummaryIcon = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number) => {
  drawShowAISummaryIcon(ctx, x, y, size);
  ctx.save();
  ctx.strokeStyle = AI_SUMMARY_BUTTON_COLOR;
  ctx.lineWidth = Math.max(1, size / 7);
  const s = size * 0.9;
  const offX = x + size * 0.05;
  const offY = y + size * 0.05;
  ctx.beginPath();
  ctx.moveTo(offX, offY + s);
  ctx.lineTo(offX + s, offY);
  ctx.stroke();
  ctx.restore();
};

const drawLoadingAISummaryIcon = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number) => {
  ctx.save();
  ctx.strokeStyle = AI_SUMMARY_LOADING_COLOR;
  ctx.lineWidth = Math.max(1, size / 6);
  const s = size * 0.7;
  const offX = x + size * 0.15;
  const offY = y + size * 0.15;
  ctx.beginPath();
  ctx.arc(offX + s / 2, offY + s / 2, s / 2.5, Math.PI * 0.2, Math.PI * 1.2);
  ctx.stroke();
  ctx.restore();
};

const drawEditMermaidIcon = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number) => {
    ctx.save();
    ctx.strokeStyle = AI_SUMMARY_BUTTON_COLOR;
    ctx.lineWidth = Math.max(1, size / 9);
    const s = size * 0.75;
    const offX = x + size * 0.125;
    const offY = y + size * 0.125;
    ctx.beginPath();
    ctx.moveTo(offX + s * 0.2, offY + s * 0.8);
    ctx.lineTo(offX + s * 0.8, offY + s * 0.2);
    ctx.lineTo(offX + s * 0.65, offY + s * 0.05);
    ctx.lineTo(offX + s * 0.95, offY + s * 0.35);
    ctx.lineTo(offX + s * 0.8, offY + s * 0.2);
    ctx.moveTo(offX + s * 0.2, offY + s * 0.8);
    ctx.lineTo(offX + s * 0.1, offY + s * 0.9);
    ctx.lineTo(offX + s * 0.3, offY + s * 1.1);
    ctx.lineTo(offX + s * 0.4, offY + s * 1.0);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
};


export const drawPath = (ctx: CanvasRenderingContext2D, element: PathElement, viewBoxX: number, viewBoxY: number, zoomLevel: number) => {
  ctx.beginPath();
  ctx.strokeStyle = element.color;
  ctx.lineWidth = Math.max(1, element.strokeWidth * zoomLevel);
  element.points.forEach((point, index) => {
    const vp = toScreen(point, viewBoxX, viewBoxY, zoomLevel);
    if (index === 0) ctx.moveTo(vp.x, vp.y);
    else ctx.lineTo(vp.x, vp.y);
  });
  if (element.points.length > 0) ctx.stroke();
};

export const drawTextElement = (ctx: CanvasRenderingContext2D, element: TextElement, viewBoxX: number, viewBoxY: number, zoomLevel: number) => {
  const vp = toScreen({ x: element.x, y: element.y }, viewBoxX, viewBoxY, zoomLevel);
  const originalFontSize = parseFloat(element.font) || DEFAULT_FONT_SIZE;
  const scaledFontSize = Math.max(1, originalFontSize * zoomLevel);
  const fontFamily = element.font.split('px ')[1] || DEFAULT_FONT_FAMILY;

  ctx.fillStyle = element.color;
  ctx.font = `${scaledFontSize}px ${fontFamily}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(element.text, vp.x, vp.y);
};

export const drawUrlElement = (ctx: CanvasRenderingContext2D, element: UrlElement, viewBoxX: number, viewBoxY: number, zoomLevel: number) => {
  const vp = toScreen({ x: element.x, y: element.y }, viewBoxX, viewBoxY, zoomLevel);
  const scaledFontSize = Math.max(1, element.fontSize * zoomLevel);
  const textToDisplay = element.displayText || element.urlText;

  ctx.fillStyle = element.color;
  ctx.font = `${scaledFontSize}px ${element.fontFamily}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(textToDisplay, vp.x, vp.y);

  const textMetrics = ctx.measureText(textToDisplay);
  const underlineY = vp.y + scaledFontSize + (2 * zoomLevel); 
  ctx.beginPath();
  ctx.moveTo(vp.x, underlineY);
  ctx.lineTo(vp.x + textMetrics.width, underlineY);
  ctx.strokeStyle = element.color; 
  ctx.lineWidth = Math.max(1, 1 * zoomLevel);
  ctx.stroke();
};


export const drawFlowchartShape = (
  ctx: CanvasRenderingContext2D,
  element: FlowchartShapeElement,
  viewBoxX: number,
  viewBoxY: number,
  zoomLevel: number
) => {
  const vpTopLeft = toScreen({ x: element.x, y: element.y }, viewBoxX, viewBoxY, zoomLevel);
  const x = vpTopLeft.x;
  const y = vpTopLeft.y;
  const scaledWidth = element.width * zoomLevel;
  const scaledHeight = element.height * zoomLevel;

  const { shapeType, fillColor, borderColor, text, textColor } = element;
  const scaledStrokeWidth = Math.max(1, element.strokeWidth * zoomLevel);

  ctx.fillStyle = fillColor;
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = scaledStrokeWidth;

  if (shapeType !== 'cylinder') {
    ctx.beginPath();
    if (shapeType === 'rectangle') {
      ctx.rect(x, y, scaledWidth, scaledHeight);
    } else if (shapeType === 'oval') {
      ctx.ellipse(x + scaledWidth / 2, y + scaledHeight / 2, scaledWidth / 2, scaledHeight / 2, 0, 0, 2 * Math.PI);
    } else if (shapeType === 'diamond') {
      ctx.moveTo(x + scaledWidth / 2, y);
      ctx.lineTo(x + scaledWidth, y + scaledHeight / 2);
      ctx.lineTo(x + scaledWidth / 2, y + scaledHeight);
      ctx.lineTo(x, y + scaledHeight / 2);
      ctx.closePath();
    } else if (shapeType === 'triangle') {
      ctx.moveTo(x + scaledWidth / 2, y);
      ctx.lineTo(x + scaledWidth, y + scaledHeight);
      ctx.lineTo(x, y + scaledHeight);
      ctx.closePath();
    } else if (shapeType === 'parallelogram') {
      const skew = scaledWidth * 0.20;
      ctx.moveTo(x + skew, y);
      ctx.lineTo(x + scaledWidth, y);
      ctx.lineTo(x + scaledWidth - skew, y + scaledHeight);
      ctx.lineTo(x, y + scaledHeight);
      ctx.closePath();
    } else if (shapeType === 'hexagon') {
      const side = scaledHeight / 2;
      ctx.moveTo(x + scaledWidth * 0.25, y);
      ctx.lineTo(x + scaledWidth * 0.75, y);
      ctx.lineTo(x + scaledWidth, y + side);
      ctx.lineTo(x + scaledWidth * 0.75, y + scaledHeight);
      ctx.lineTo(x + scaledWidth * 0.25, y + scaledHeight);
      ctx.lineTo(x, y + side);
      ctx.closePath();
    } else if (shapeType === 'cloud') {
      const r1 = Math.min(scaledWidth, scaledHeight) * 0.3;
      const r2 = Math.min(scaledWidth, scaledHeight) * 0.25;
      const r3 = Math.min(scaledWidth, scaledHeight) * 0.35;
      ctx.arc(x + scaledWidth * 0.3, y + scaledHeight * 0.4, r1, Math.PI * 0.8, Math.PI * 1.9);
      ctx.arc(x + scaledWidth * 0.6, y + scaledHeight * 0.3, r2, Math.PI * 1.2, Math.PI * 0.2);
      ctx.arc(x + scaledWidth * 0.7, y + scaledHeight * 0.65, r3, Math.PI * 1.7, Math.PI * 0.7);
      ctx.arc(x + scaledWidth * 0.4, y + scaledHeight * 0.75, r1, Math.PI * 0.2, Math.PI * 1.1);
      ctx.closePath();
    } else if (shapeType === 'star') {
      const outerRadius = Math.min(scaledWidth, scaledHeight) / 2;
      const innerRadius = outerRadius / 2.5;
      const centerX = x + scaledWidth / 2;
      const centerY = y + scaledHeight / 2;
      let rot = Math.PI / 2 * 3;
      ctx.moveTo(centerX, centerY - outerRadius);
      for (let i = 0; i < 5; i++) {
        ctx.lineTo(centerX + Math.cos(rot) * outerRadius, centerY + Math.sin(rot) * outerRadius);
        rot += Math.PI / 5;
        ctx.lineTo(centerX + Math.cos(rot) * innerRadius, centerY + Math.sin(rot) * innerRadius);
        rot += Math.PI / 5;
      }
      ctx.closePath();
    }
    if (fillColor !== TRANSPARENT_FILL_VALUE) ctx.fill();
    ctx.stroke();
  } else {
    const capHeight = Math.min(scaledHeight * 0.2, scaledWidth / 4, 20 * zoomLevel);
    ctx.beginPath();
    ctx.ellipse(x + scaledWidth / 2, y + capHeight, scaledWidth / 2, capHeight, 0, 0, 2 * Math.PI);
    if (fillColor !== TRANSPARENT_FILL_VALUE) ctx.fill();
    ctx.stroke();
    if (fillColor !== TRANSPARENT_FILL_VALUE) {
      ctx.beginPath();
      ctx.rect(x, y + capHeight, scaledWidth, scaledHeight - 2 * capHeight);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.ellipse(x + scaledWidth / 2, y + scaledHeight - capHeight, scaledWidth / 2, capHeight, 0, 0, Math.PI);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y + capHeight);
    ctx.lineTo(x, y + scaledHeight - capHeight);
    ctx.moveTo(x + scaledWidth, y + capHeight);
    ctx.lineTo(x + scaledWidth, y + scaledHeight - capHeight);
    ctx.stroke();
  }

  if (text) {
    const scaledFontSize = Math.max(1, DEFAULT_FONT_SIZE * zoomLevel);
    ctx.fillStyle = textColor;
    ctx.font = `${scaledFontSize}px ${DEFAULT_FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const lines = [];
    const words = text.split(' ');
    let currentLine = '';
    const maxTextWidth = scaledWidth - (10 * zoomLevel);
    for (const word of words) {
      const testLine = currentLine ? currentLine + ' ' + word : word;
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxTextWidth && currentLine !== '') {
        lines.push(currentLine);
        currentLine = word;
      } else { currentLine = testLine; }
    }
    lines.push(currentLine);

    const lineHeight = scaledFontSize * 1.2;
    const totalTextHeight = lines.length * lineHeight;
    let startTextY = y + scaledHeight / 2 - totalTextHeight / 2 + lineHeight / 2;
    const maxDrawableTextHeight = scaledHeight - (10 * zoomLevel);

    if (totalTextHeight > maxDrawableTextHeight && lines.length > 1) {
        startTextY = y + (5 * zoomLevel) + lineHeight / 2;
    }

    for (let i = 0; i < lines.length; i++) {
      if ((i * lineHeight) + (lineHeight / 2) > maxDrawableTextHeight && lines.length > 1) break;
      ctx.fillText(lines[i], x + scaledWidth / 2, startTextY + i * lineHeight);
    }
  }
};

export const drawConnector = (ctx: CanvasRenderingContext2D, element: ConnectorElement, viewBoxX: number, viewBoxY: number, zoomLevel: number) => {
  const vpStart = toScreen(element.startPoint, viewBoxX, viewBoxY, zoomLevel);
  const vpEnd = toScreen(element.endPoint, viewBoxX, viewBoxY, zoomLevel);
  const { color, lineStyle = DEFAULT_LINE_STYLE } = element;
  const scaledStrokeWidth = Math.max(1, element.strokeWidth * zoomLevel);

  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = scaledStrokeWidth;

  if (lineStyle === 'dotted') {
    const dashLength = Math.max(2, scaledStrokeWidth * 1.5);
    const gapLength = Math.max(2, scaledStrokeWidth * 1.5);
    ctx.setLineDash([dashLength, gapLength]);
  }

  ctx.moveTo(vpStart.x, vpStart.y);
  ctx.lineTo(vpEnd.x, vpEnd.y);
  ctx.stroke();

  if (lineStyle === 'dotted') ctx.setLineDash([]);

  if (lineStyle === 'arrow') {
    const angle = Math.atan2(vpEnd.y - vpStart.y, vpEnd.x - vpStart.x);
    const headLength = Math.min(15 * zoomLevel, scaledStrokeWidth * 3 + (5 * zoomLevel));
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(vpEnd.x, vpEnd.y);
    ctx.lineTo(vpEnd.x - headLength * Math.cos(angle - Math.PI / 6), vpEnd.y - headLength * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(vpEnd.x - headLength * Math.cos(angle + Math.PI / 6), vpEnd.y - headLength * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
  }
};

export const drawImageElement = (
  ctx: CanvasRenderingContext2D,
  element: ImageElement,
  imageObject: HTMLImageElement | undefined,
  viewBoxX: number,
  viewBoxY: number,
  zoomLevel: number
) => {
  const vp = toScreen({ x: element.x, y: element.y }, viewBoxX, viewBoxY, zoomLevel);
  const scaledWidth = element.width * zoomLevel;
  const scaledHeight = element.height * zoomLevel;

  if (imageObject && imageObject.complete) {
    ctx.drawImage(imageObject, vp.x, vp.y, scaledWidth, scaledHeight);
  } else {
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(vp.x, vp.y, scaledWidth, scaledHeight);
    ctx.strokeStyle = '#cccccc';
    ctx.strokeRect(vp.x, vp.y, scaledWidth, scaledHeight);
    ctx.fillStyle = '#999999';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${12 * zoomLevel}px Arial`;
    const isSvg = element.src.startsWith('data:image/svg+xml');
    const placeholderText = imageObject ? (isSvg ? 'Rendering...' : 'Loading...') : 'Error';
    ctx.fillText(placeholderText, vp.x + scaledWidth / 2, vp.y + scaledHeight / 2);
  }
};

export const drawEmojiElement = (ctx: CanvasRenderingContext2D, element: EmojiElement, viewBoxX: number, viewBoxY: number, zoomLevel: number) => {
  const vp = toScreen({ x: element.x, y: element.y }, viewBoxX, viewBoxY, zoomLevel);
  const scaledSize = Math.max(1, element.size * zoomLevel);
  ctx.font = `${scaledSize}px ${DEFAULT_FONT_FAMILY}`;
  ctx.fillStyle = 'black';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(element.emojiChar, vp.x, vp.y);
};

export const drawContentBoxElement = (ctx: CanvasRenderingContext2D, element: ContentBoxElement, viewBoxX: number, viewBoxY: number, zoomLevel: number) => {
  const vpTopLeft = toScreen({ x: element.x, y: element.y }, viewBoxX, viewBoxY, zoomLevel);
  const x = vpTopLeft.x;
  const y = vpTopLeft.y;
  const scaledWidth = element.width * zoomLevel;
  const scaledHeight = element.height * zoomLevel;
  const { backgroundColor, textColor, content, filename, contentType } = element;
  const scaledFontSize = Math.max(1, element.fontSize * zoomLevel);

  ctx.fillStyle = backgroundColor;
  ctx.fillRect(x, y, scaledWidth, scaledHeight);
  ctx.strokeStyle = '#A0AEC0';
  ctx.lineWidth = Math.max(1, 1 * zoomLevel);
  ctx.strokeRect(x, y, scaledWidth, scaledHeight);

  const scaledHeaderHeight = Math.max(10 * zoomLevel, 24 * zoomLevel);
  const scaledHeaderPadding = 5 * zoomLevel;
  ctx.fillStyle = '#E2E8F0';
  ctx.fillRect(x, y, scaledWidth, scaledHeaderHeight);
  ctx.strokeStyle = '#CBD5E0';
  ctx.strokeRect(x, y, scaledWidth, scaledHeaderHeight);

  ctx.fillStyle = '#4A5568';
  ctx.font = `bold ${Math.max(1, 12 * zoomLevel)}px ${DEFAULT_FONT_FAMILY}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const headerText = filename ? `${filename} (${contentType})` : contentType;
  ctx.fillText(headerText, x + scaledHeaderPadding, y + scaledHeaderHeight / 2, scaledWidth - scaledHeaderPadding * 2);

  ctx.fillStyle = textColor;
  ctx.font = `${scaledFontSize}px ${contentType === 'javascript' || contentType === 'python' || contentType === 'json' ? 'monospace' : DEFAULT_FONT_FAMILY}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  const scaledContentPadding = 8 * zoomLevel;
  const contentStartX = x + scaledContentPadding;
  const contentStartY = y + scaledHeaderHeight + scaledContentPadding;
  const maxContentWidth = scaledWidth - scaledContentPadding * 2;
  const maxContentHeight = scaledHeight - scaledHeaderHeight - scaledContentPadding * 2;

  if (maxContentWidth <= 0 || maxContentHeight <= 0) return;

  const lines = content.split('\n');
  let currentY = contentStartY;
  const lineHeight = scaledFontSize * 1.3;

  ctx.save();
  ctx.beginPath();
  ctx.rect(contentStartX, contentStartY, maxContentWidth, maxContentHeight);
  ctx.clip();

  for (const line of lines) {
    if (currentY + lineHeight > contentStartY + maxContentHeight + scaledFontSize * 0.3) {
        if (currentY <= contentStartY + maxContentHeight - lineHeight) {
             const lastVisibleLineY = currentY - lineHeight;
             ctx.fillText("...", contentStartX, lastVisibleLineY, maxContentWidth);
        }
        break;
    }
    let currentLineText = line;
    let textMetrics = ctx.measureText(currentLineText);
    if (textMetrics.width > maxContentWidth) {
        let words = line.split(' ');
        let wrappedLine = '';
        for (let i = 0; i < words.length; i++) {
            let testLine = wrappedLine + words[i] + ' ';
            if (ctx.measureText(testLine).width > maxContentWidth && i > 0) {
                ctx.fillText(wrappedLine, contentStartX, currentY, maxContentWidth);
                currentY += lineHeight;
                if (currentY + lineHeight > contentStartY + maxContentHeight + scaledFontSize * 0.3) break;
                wrappedLine = words[i] + ' ';
            } else { wrappedLine = testLine; }
        }
        currentLineText = wrappedLine.trim();
    }
    if (currentY + lineHeight <= contentStartY + maxContentHeight + scaledFontSize * 0.3) {
       ctx.fillText(currentLineText, contentStartX, currentY, maxContentWidth);
    }
    currentY += lineHeight;
  }
  ctx.restore();
};

export const drawGroupElement = (
  ctx: CanvasRenderingContext2D,
  element: GroupElement,
  viewBoxX: number,
  viewBoxY: number,
  zoomLevel: number
) => {
  // This function is intended to draw the GroupElement itself if it has a visual representation
  // beyond its children (e.g., a border if it's *not* selected).
  // Currently, the selection outline for a group is handled by `drawSelectionOutline`.
  // Child elements are drawn independently by the main draw loop.

  // Example: Draw a very faint dashed border for an unselected group for debugging/visualization.
  // This would typically only be drawn if the group itself is not the currently selected element.
  // const screenPos = toScreen({ x: element.x, y: element.y }, viewBoxX, viewBoxY, zoomLevel);
  // const screenWidth = element.width * zoomLevel;
  // const screenHeight = element.height * zoomLevel;

  // ctx.strokeStyle = 'rgba(128, 128, 128, 0.5)'; // Light gray, semi-transparent
  // ctx.lineWidth = Math.max(1, 1 * zoomLevel);
  // ctx.setLineDash([2 * zoomLevel, 4 * zoomLevel]);
  // ctx.strokeRect(screenPos.x, screenPos.y, screenWidth, screenHeight);
  // ctx.setLineDash([]);
};


export const getElementBoundingBox = (
  element: WhiteboardElement,
  ctxForTextMeasurement: CanvasRenderingContext2D | null
): { x: number; y: number; width: number; height: number } | null => {
  switch (element.type) {
    case 'flowchart-shape':
    case 'image':
    case 'content-box':
    case 'group': 
      return { x: element.x, y: element.y, width: element.width, height: element.height };
    case 'path': {
      if (element.points.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
      let minX = element.points[0].x; let minY = element.points[0].y;
      let maxX = element.points[0].x; let maxY = element.points[0].y;
      element.points.forEach(p => {
        minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
      });
      const padding = element.strokeWidth / 2 + 2;
      return { x: minX - padding, y: minY - padding, width: (maxX - minX) + element.strokeWidth + 4, height: (maxY - minY) + element.strokeWidth + 4 };
    }
    case 'connector': {
      const minX = Math.min(element.startPoint.x, element.endPoint.x);
      const minY = Math.min(element.startPoint.y, element.endPoint.y);
      const maxX = Math.max(element.startPoint.x, element.endPoint.x);
      const maxY = Math.max(element.startPoint.y, element.endPoint.y);
      const padding = element.strokeWidth / 2 + 5;
      return { x: minX - padding, y: minY - padding, width: (maxX - minX) + element.strokeWidth + 10, height: (maxY - minY) + element.strokeWidth + 10 };
    }
    case 'text': {
      if (!ctxForTextMeasurement) return null;
      const originalFontSize = parseFloat(element.font) || DEFAULT_FONT_SIZE;
      const originalFontFamily = element.font.split('px ')[1] || DEFAULT_FONT_FAMILY;
      ctxForTextMeasurement.font = `${originalFontSize}px ${originalFontFamily}`; 
      const metrics = ctxForTextMeasurement.measureText(element.text);
      const fontHeightMetrics = ctxForTextMeasurement.measureText('M');
      const actualBoundingBoxAscent = fontHeightMetrics.actualBoundingBoxAscent || originalFontSize;
      const actualBoundingBoxDescent = fontHeightMetrics.actualBoundingBoxDescent || 0;
      const fontHeight = actualBoundingBoxAscent + actualBoundingBoxDescent;
      return { x: element.x, y: element.y, width: metrics.width, height: fontHeight > 0 ? fontHeight : originalFontSize };
    }
    case 'url': {
      if (!ctxForTextMeasurement) return null;
      const textToMeasure = element.displayText || element.urlText;
      ctxForTextMeasurement.font = `${element.fontSize}px ${element.fontFamily}`;
      const metrics = ctxForTextMeasurement.measureText(textToMeasure);
      const fontHeightMetrics = ctxForTextMeasurement.measureText('M');
      const actualBoundingBoxAscent = fontHeightMetrics.actualBoundingBoxAscent || element.fontSize;
      const actualBoundingBoxDescent = fontHeightMetrics.actualBoundingBoxDescent || 0;
      let height = actualBoundingBoxAscent + actualBoundingBoxDescent;
      height += 2; 
      return { x: element.x, y: element.y, width: metrics.width, height: height > 0 ? height : element.fontSize + 2 };
    }
    case 'emoji': {
      if (!ctxForTextMeasurement) return null;
      ctxForTextMeasurement.font = `${element.size}px ${DEFAULT_FONT_FAMILY}`;
      const metrics = ctxForTextMeasurement.measureText(element.emojiChar);
      const capitalM_metrics = ctxForTextMeasurement.measureText('M');
      const ascent = capitalM_metrics.actualBoundingBoxAscent || element.size * 0.75;
      const descent = capitalM_metrics.actualBoundingBoxDescent || element.size * 0.25;
      const height = ascent + descent;
      return { x: element.x, y: element.y, width: metrics.width, height: height };
    }
    default:
      const _exhaustiveCheck: never = element;
      return null;
  }
};

export const isPointInElement = (
  virtualPoint: Point,
  element: WhiteboardElement,
  ctxForTextMeasurement: CanvasRenderingContext2D | null
): boolean => {
  const bbox = getElementBoundingBox(element, ctxForTextMeasurement); 
  if (!bbox) return false;

  // For groups, direct bounding box check is sufficient for selection purposes.
  // Child interaction logic will be more complex if needed later.
  if (element.type === 'group') {
     return virtualPoint.x >= bbox.x && virtualPoint.x <= bbox.x + bbox.width &&
            virtualPoint.y >= bbox.y && virtualPoint.y <= bbox.y + bbox.height;
  }

  // Path and Connector use a slightly more generous bounding box for easier clicking.
  if (element.type === 'path' || element.type === 'connector') {
      return virtualPoint.x >= bbox.x && virtualPoint.x <= bbox.x + bbox.width &&
             virtualPoint.y >= bbox.y && virtualPoint.y <= bbox.y + bbox.height;
  }
  
  const clickPaddingVirtual = 5; 
  return virtualPoint.x >= bbox.x - clickPaddingVirtual && virtualPoint.x <= bbox.x + bbox.width + clickPaddingVirtual &&
         virtualPoint.y >= bbox.y - clickPaddingVirtual && virtualPoint.y <= bbox.y + bbox.height + clickPaddingVirtual;
};


export const getResizeHandles = (
  element: FlowchartShapeElement | EmojiElement | ImageElement | ContentBoxElement | GroupElement, 
  ctxForBBox: CanvasRenderingContext2D | null, 
  viewBoxX: number,
  viewBoxY: number,
  zoomLevel: number
): ResizeHandle[] => {
  const virtualBbox = getElementBoundingBox(element, ctxForBBox);
  if (!virtualBbox) return [];

  const screenTopLeft = toScreen(virtualBbox, viewBoxX, viewBoxY, zoomLevel);
  const screenWidth = virtualBbox.width * zoomLevel;
  const screenHeight = virtualBbox.height * zoomLevel;

  const scaledHandleSize = HANDLE_SIZE * zoomLevel; 
  const hs = scaledHandleSize / 2;

  return [
    { type: 'nw', x: screenTopLeft.x - hs, y: screenTopLeft.y - hs, width: scaledHandleSize, height: scaledHandleSize, cursor: 'nwse-resize' },
    { type: 'n', x: screenTopLeft.x + screenWidth / 2 - hs, y: screenTopLeft.y - hs, width: scaledHandleSize, height: scaledHandleSize, cursor: 'ns-resize' },
    { type: 'ne', x: screenTopLeft.x + screenWidth - hs, y: screenTopLeft.y - hs, width: scaledHandleSize, height: scaledHandleSize, cursor: 'nesw-resize' },
    { type: 'w', x: screenTopLeft.x - hs, y: screenTopLeft.y + screenHeight / 2 - hs, width: scaledHandleSize, height: scaledHandleSize, cursor: 'ew-resize' },
    { type: 'e', x: screenTopLeft.x + screenWidth - hs, y: screenTopLeft.y + screenHeight / 2 - hs, width: scaledHandleSize, height: scaledHandleSize, cursor: 'ew-resize' },
    { type: 'sw', x: screenTopLeft.x - hs, y: screenTopLeft.y + screenHeight - hs, width: scaledHandleSize, height: scaledHandleSize, cursor: 'nesw-resize' },
    { type: 's', x: screenTopLeft.x + screenWidth / 2 - hs, y: screenTopLeft.y + screenHeight - hs, width: scaledHandleSize, height: scaledHandleSize, cursor: 'ns-resize' },
    { type: 'se', x: screenTopLeft.x + screenWidth - hs, y: screenTopLeft.y + screenHeight - hs, width: scaledHandleSize, height: scaledHandleSize, cursor: 'nwse-resize' },
  ];
};

export const drawResizeHandlesForElement = (
  ctx: CanvasRenderingContext2D,
  element: FlowchartShapeElement | EmojiElement | ImageElement | ContentBoxElement | GroupElement,
  viewBoxX: number,
  viewBoxY: number,
  zoomLevel: number
) => {
  const handles = getResizeHandles(element, ctx, viewBoxX, viewBoxY, zoomLevel); 
  ctx.strokeStyle = '#3B82F6';
  ctx.fillStyle = '#FFFFFF';
  ctx.lineWidth = Math.max(1, 1 * zoomLevel); 
  handles.forEach(handle => {
    ctx.fillRect(handle.x, handle.y, handle.width, handle.height);
    ctx.strokeRect(handle.x, handle.y, handle.width, handle.height);
  });
};

export const drawSelectionOutline = (
  ctx: CanvasRenderingContext2D,
  element: WhiteboardElement,
  viewBoxX: number,
  viewBoxY: number,
  zoomLevel: number
) => {
    const virtualBbox = getElementBoundingBox(element, ctx);
    if (!virtualBbox) return;

    const screenPos = toScreen(virtualBbox, viewBoxX, viewBoxY, zoomLevel);
    const screenWidth = virtualBbox.width * zoomLevel;
    const screenHeight = virtualBbox.height * zoomLevel;

    ctx.strokeStyle = '#3B82F6'; // Blue-500
    ctx.lineWidth = Math.max(1, (element.type === 'group' ? 2 : 1) * zoomLevel); // Thicker for groups
    ctx.setLineDash([3 * zoomLevel, 3 * zoomLevel]);

    if (element.type === 'text' || element.type === 'url') {
        const padding = 2 * zoomLevel;
        ctx.strokeRect(screenPos.x - padding, screenPos.y - padding, screenWidth + 2 * padding, screenHeight + 2 * padding);
    } else if (element.type === 'path') {
        ctx.strokeRect(screenPos.x, screenPos.y, screenWidth, screenHeight);
    } else if (element.type === 'connector') {
        ctx.fillStyle = '#3B82F6';
        const circleRadius = 4 * zoomLevel; 
        const vpStart = toScreen(element.startPoint, viewBoxX, viewBoxY, zoomLevel);
        const vpEnd = toScreen(element.endPoint, viewBoxX, viewBoxY, zoomLevel);
        ctx.beginPath(); ctx.arc(vpStart.x, vpStart.y, circleRadius, 0, 2 * Math.PI); ctx.fill();
        ctx.beginPath(); ctx.arc(vpEnd.x, vpEnd.y, circleRadius, 0, 2 * Math.PI); ctx.fill();
        ctx.beginPath(); ctx.moveTo(vpStart.x, vpStart.y); ctx.lineTo(vpEnd.x, vpEnd.y); ctx.stroke();
    } else if (element.type === 'flowchart-shape' || element.type === 'emoji' || element.type === 'image' || element.type === 'content-box' || element.type === 'group') {
        ctx.strokeRect(screenPos.x, screenPos.y, screenWidth, screenHeight);
    }
    ctx.setLineDash([]);
};

export const getHandleAtPoint = (
  viewportPoint: Point, 
  element: FlowchartShapeElement | EmojiElement | ImageElement | ContentBoxElement | GroupElement, 
  ctxForBBox: CanvasRenderingContext2D | null,
  viewBoxX: number,
  viewBoxY: number,
  zoomLevel: number
): ResizeHandleType | null => {
  const handles = getResizeHandles(element, ctxForBBox, viewBoxX, viewBoxY, zoomLevel); 
  for (const handle of handles) {
    if (viewportPoint.x >= handle.x && viewportPoint.x <= handle.x + handle.width &&
        viewportPoint.y >= handle.y && viewportPoint.y <= handle.y + handle.height) {
      return handle.type;
    }
  }
  return null;
};

export const getConnectorAttachmentPoints = (element: WhiteboardElement): Array<{ point: Point; index: number }> => {
  if (element.type === 'flowchart-shape' || element.type === 'content-box' || element.type === 'image' || element.type === 'group') {
    const { x, y, width, height } = element; 
    return [
      { point: { x: x + width / 2, y: y }, index: 0 }, 
      { point: { x: x + width, y: y + height / 2 }, index: 1 }, 
      { point: { x: x + width / 2, y: y + height }, index: 2 }, 
      { point: { x: x, y: y + height / 2 }, index: 3 }, 
    ];
  }
  return [];
};

export const drawConnectorHandles = (
  ctx: CanvasRenderingContext2D,
  element: WhiteboardElement,
  viewBoxX: number,
  viewBoxY: number,
  zoomLevel: number
) => {
  const attachmentPointsWithIndices = getConnectorAttachmentPoints(element); 
  if (attachmentPointsWithIndices.length === 0) return;

  const scaledRadius = CONNECTOR_HANDLE_RADIUS * zoomLevel;
  const scaledStrokeWidth = Math.max(1, CONNECTOR_HANDLE_STROKE_WIDTH * zoomLevel);

  attachmentPointsWithIndices.forEach(item => {
    const vp = toScreen(item.point, viewBoxX, viewBoxY, zoomLevel); 
    ctx.beginPath();
    ctx.arc(vp.x, vp.y, scaledRadius, 0, 2 * Math.PI);
    ctx.fillStyle = CONNECTOR_HANDLE_FILL_COLOR;
    ctx.fill();
    ctx.strokeStyle = CONNECTOR_HANDLE_STROKE_COLOR;
    ctx.lineWidth = scaledStrokeWidth;
    ctx.stroke();
  });
};

export const drawSnapTargetHighlight = (
  ctx: CanvasRenderingContext2D,
  targetVirtualPoint: Point,
  viewBoxX: number,
  viewBoxY: number,
  zoomLevel: number
) => {
  const vp = toScreen(targetVirtualPoint, viewBoxX, viewBoxY, zoomLevel); 
  const scaledRadius = CONNECTOR_SNAP_TARGET_RADIUS * zoomLevel;
  ctx.beginPath();
  ctx.arc(vp.x, vp.y, scaledRadius, 0, 2 * Math.PI);
  ctx.fillStyle = CONNECTOR_SNAP_TARGET_FILL_COLOR;
  ctx.fill();
};


export const getElementSummaryActionButtons = (
    element: WhiteboardElement,
    viewBoxX: number,
    viewBoxY: number,
    zoomLevel: number,
    ctxForBBox: CanvasRenderingContext2D | null
): ElementSummaryActionButton[] => {
    if (element.type === 'connector') return []; 

    const virtualBbox = getElementBoundingBox(element, ctxForBBox);
    if (!virtualBbox) return [];

    const screenTopLeft = toScreen(virtualBbox, viewBoxX, viewBoxY, zoomLevel);
    const screenWidth = virtualBbox.width * zoomLevel;

    const scaledButtonSize = AI_SUMMARY_BUTTON_SIZE * zoomLevel;
    const scaledPadding = AI_SUMMARY_BUTTON_PADDING * zoomLevel;

    let currentButtonX = screenTopLeft.x + screenWidth - scaledButtonSize - scaledPadding;
    const buttonY = screenTopLeft.y + scaledPadding;

    const buttons: ElementSummaryActionButton[] = [];

    if (element.type === 'image' && element.mermaidSyntax) {
        buttons.push({
            type: 'editMermaid',
            x: currentButtonX, y: buttonY, width: scaledButtonSize, height: scaledButtonSize,
            icon: drawEditMermaidIcon
        });
        currentButtonX -= (scaledButtonSize + scaledPadding);
    }
    
    if (element.type === 'group' || (element as any).aiSummary !== undefined) { // Check if element can have summary
      if (element.aiSummaryLoading) {
          buttons.push({
              type: 'loadingSummary',
              x: currentButtonX, y: buttonY, width: scaledButtonSize, height: scaledButtonSize,
              icon: drawLoadingAISummaryIcon
          });
      } else {
          buttons.push({
              type: 'regenerateSummary',
              x: currentButtonX, y: buttonY, width: scaledButtonSize, height: scaledButtonSize,
              icon: drawRegenerateAISummaryIcon
          });
          currentButtonX -= (scaledButtonSize + scaledPadding);

          if (element.aiSummary && element.aiSummary.trim() !== "" && !element.aiSummary.startsWith("Error:")) {
              buttons.push({
                  type: element.aiSummaryVisible ? 'hideSummary' : 'showSummary',
                  x: currentButtonX, y: buttonY, width: scaledButtonSize, height: scaledButtonSize,
                  icon: element.aiSummaryVisible ? drawHideAISummaryIcon : drawShowAISummaryIcon
              });
          }
      }
    }
    return buttons;
};

export const drawElementActionButtons = (
  ctx: CanvasRenderingContext2D,
  element: WhiteboardElement,
  viewBoxX: number,
  viewBoxY: number,
  zoomLevel: number
) => {
  const buttons = getElementSummaryActionButtons(element, viewBoxX, viewBoxY, zoomLevel, ctx);
  buttons.forEach(button => {
    button.icon(ctx, button.x, button.y, button.width); 
  });
};

export const drawAISummaryText = (
  ctx: CanvasRenderingContext2D,
  element: WhiteboardElement,
  viewBoxX: number,
  viewBoxY: number,
  zoomLevel: number
) => {
  if (element.type === 'connector' || !element.aiSummary || !element.aiSummaryVisible) return;

  const virtualBbox = getElementBoundingBox(element, ctx);
  if (!virtualBbox) return;

  const screenTopLeft = toScreen(virtualBbox, viewBoxX, viewBoxY, zoomLevel);
  const screenHeight = virtualBbox.height * zoomLevel;

  const scaledButtonSize = AI_SUMMARY_BUTTON_SIZE * zoomLevel;
  const scaledPadding = AI_SUMMARY_BUTTON_PADDING * zoomLevel;
  const scaledOffsetX = AI_SUMMARY_OFFSET_X * zoomLevel;
  const scaledOffsetY = AI_SUMMARY_OFFSET_Y * zoomLevel;
  const scaledMarginFromButtons = AI_SUMMARY_MARGIN_FROM_BUTTONS * zoomLevel;
  const scaledTextFontSize = AI_SUMMARY_TEXT_FONT_SIZE * zoomLevel;
  const scaledTextPadding = AI_SUMMARY_TEXT_PADDING * zoomLevel;
  const scaledMaxWidth = AI_SUMMARY_TEXT_MAX_WIDTH * zoomLevel;

  const numberOfButtons = getElementSummaryActionButtons(element, viewBoxX, viewBoxY, zoomLevel, ctx).length;
  const totalButtonWidth = numberOfButtons * scaledButtonSize + (numberOfButtons > 0 ? (numberOfButtons -1) * scaledPadding : 0);
  const buttonRowHeight = scaledButtonSize + scaledPadding * 2;

  let summaryX = screenTopLeft.x + scaledOffsetX;
  let summaryY = screenTopLeft.y + screenHeight + scaledOffsetY + (totalButtonWidth > 0 ? buttonRowHeight / 3 : 0) + scaledMarginFromButtons;

  ctx.font = `${scaledTextFontSize}px ${DEFAULT_FONT_FAMILY}`;
  const lines = [];
  const words = element.aiSummary.split(' ');
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine + (currentLine ? ' ' : '') + word;
    const metrics = ctx.measureText(testLine); 
    if (metrics.width > scaledMaxWidth && currentLine !== '') {
      lines.push(currentLine); currentLine = word;
    } else { currentLine = testLine; }
  }
  lines.push(currentLine);

  const lineHeight = scaledTextFontSize * AI_SUMMARY_TEXT_LINE_HEIGHT;
  const summaryHeight = lines.length * lineHeight + scaledTextPadding * 2;
  const summaryWidth = Math.min(
    scaledMaxWidth + scaledTextPadding * 2,
    Math.max(...lines.map(line => ctx.measureText(line).width)) + scaledTextPadding * 2
  );

  if (summaryX + summaryWidth > ctx.canvas.width) summaryX = ctx.canvas.width - summaryWidth - scaledOffsetX;
  if (summaryY + summaryHeight > ctx.canvas.height) summaryY = screenTopLeft.y - summaryHeight - scaledOffsetY - (totalButtonWidth > 0 ? buttonRowHeight/3 : 0) - scaledMarginFromButtons;
  summaryX = Math.max(scaledOffsetX, summaryX);
  summaryY = Math.max(scaledOffsetY, summaryY);

  ctx.fillStyle = AI_SUMMARY_BACKGROUND_COLOR;
  ctx.strokeStyle = AI_SUMMARY_BORDER_COLOR;
  ctx.lineWidth = Math.max(1, 1 * zoomLevel);
  ctx.beginPath(); ctx.rect(summaryX, summaryY, summaryWidth, summaryHeight); ctx.fill(); ctx.stroke();

  ctx.fillStyle = AI_SUMMARY_TEXT_COLOR;
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  lines.forEach((line, index) => {
    ctx.fillText(line, summaryX + scaledTextPadding, summaryY + scaledTextPadding + index * lineHeight);
  });
};
