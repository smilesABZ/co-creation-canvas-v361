// FILENAME: src/features/interactions/useInteractionManager.ts - VERSION: v23 (Fix Group Move Logic)
// Updated to v14 to trigger automatic summary generation and update action button logic.
// Updated to v15 to handle 'editMermaid' action button clicks.
// Updated to v16 to implement sticky connectors on element resize.
// Updated to v17 to make interactions zoom-aware.
// Updated to v18 to add URL tool interaction.
// Updated to v19 to replace window.prompt with sequential TextInputOverlay for URL tool.
// Updated to v20 to make URL tool start more robust by clearing existing text mode if necessary.
// Updated to v21 to add Shift+Click for multi-selection.
// Updated to v22 to implement group child selection, group movement, and group resizing.
// Updated to v23 to fix group move logic to use a single command for undo/redo.
import React, { useState, useCallback, useRef } from 'react';
import { Point, Tool, WhiteboardElement, PathElement, FlowchartShapeElement, ConnectorElement, EmojiElement, ImageElement, ContentBoxElement, ResizeHandleType, ShapeType, LineStyle, UrlElement, GroupElement } from '../../../types';
import { ToolManagerHook } from '../toolManager/useToolManager';
import { ElementManagerHook } from '../elementManager/useElementManager';
import { CanvasViewHook } from '../canvasView/useCanvasView';
import { TextEditingHook, TextInputConfig } from '../textEditing/useTextEditing';
import { AiHook } from '../ai/useAi';
import { MermaidHook } from '../mermaid/useMermaid';
import { getElementBoundingBox, isPointInElement, getHandleAtPoint, getResizeHandles, getConnectorAttachmentPoints, getElementSummaryActionButtons } from '../canvas/canvasUtils';
import {
    ERASER_STROKE_WIDTH, MIN_SHAPE_SIZE, DEFAULT_SHAPE_WIDTH, DEFAULT_SHAPE_HEIGHT,
    DEFAULT_FONT_SIZE, DEFAULT_FONT_FAMILY, DEFAULT_EMOJI_SIZE, TRANSPARENT_FILL_VALUE,
    DEFAULT_SHAPE_BORDER_COLOR, MIN_IMAGE_SIZE, MIN_EMOJI_SIZE, MIN_CONTENT_BOX_SIZE,
    DEFAULT_ONSCREEN_TEXT_BOX_WIDTH, DEFAULT_ONSCREEN_TEXT_BOX_HEIGHT, DEFAULT_CONTENT_BOX_FONT_SIZE,
    CONNECTOR_SNAP_PROXIMITY_THRESHOLD, CONNECTOR_HANDLE_RADIUS, HANDLE_SIZE
} from '../../../constants';
import { getTextColorForBackground } from '../../utils/colorUtils';
import { doBoundingBoxesIntersect } from '../../utils/geometryUtils';


interface InteractionManagerProps {
  toolManager: ToolManagerHook;
  elementManager: ElementManagerHook;
  canvasView: CanvasViewHook;
  textEditing: TextEditingHook;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  canvasRenderWidth: number;
  canvasRenderHeight: number;
  onEditContentBox: (element: ContentBoxElement) => void;
  mermaidHook?: MermaidHook;
}

type DrawingInteractionState = {
  tool: Tool;
  startPoint: Point; // Virtual coords
  currentPoint: Point; // Virtual coords
  elementId?: string;
  _internal_initialStartElementId?: string;
  _internal_initialStartAttachmentPointIndex?: number;
} | null;

export interface InteractionManagerHook {
  handleMouseDown: (event: React.MouseEvent | React.TouchEvent<HTMLCanvasElement>) => void;
  handleMouseMove: (event: React.MouseEvent | React.TouchEvent<HTMLCanvasElement>) => void;
  handleMouseUp: (event: React.MouseEvent | React.TouchEvent<HTMLCanvasElement>) => void;
  handleMouseLeave: () => void;
  currentCursor: string;
  isDrawingInteraction: boolean;
  currentPathPoints: Point[];
  drawingInteractionState: DrawingInteractionState;
  handleDoubleClick: (event: React.MouseEvent) => void;
  potentialSnapTarget: { elementId: string; targetPoint: Point; targetPointIndex: number } | null;
  setAiHook: (hook: AiHook) => void;
  setMermaidHook: (hook: MermaidHook) => void;
}

type UpdatableAISummaryElement = Exclude<WhiteboardElement, ConnectorElement>;

type UrlInputStep = 'idle' | 'waitingForUrl' | 'waitingForDisplayText';
interface TempUrlData {
  x: number;
  y: number;
  url?: string;
  color: string;
  fontSize: number;
  fontFamily: string;
}

export const useInteractionManager = ({
  toolManager,
  elementManager,
  canvasView,
  textEditing,
  canvasRef,
  canvasRenderWidth,
  canvasRenderHeight,
  onEditContentBox,
}: InteractionManagerProps): InteractionManagerHook => {
  const { currentTool, setCurrentTool, currentColor, currentStrokeWidth, useTransparentFill, selectedEmojiStamp, currentLineStyle } = toolManager;
  const { elements, addElement, updateElement, removeElement, selectedElementId, setSelectedElementId, getElementById, multiSelectedElementIds, toggleMultiSelectElement, clearMultiSelection, commitBatchUpdate, setElements } = elementManager;
  const { toVirtualPos, toViewportPos, panCanvas, viewBoxX, viewBoxY, zoomLevel } = canvasView;
  const { startTextEditing, isTextModeActive: isCurrentlyEditingText, cancelTextEditing: globalCancelTextEditing } = textEditing;

  const [isDrawingInteraction, setIsDrawingInteraction] = useState<boolean>(false);
  const [currentPathPointsState, setCurrentPathPointsState] = useState<Point[]>([]);
  const [drawingInteractionStateInternal, setDrawingInteractionStateInternal] =
    useState<DrawingInteractionState>(null);

  const [isPanningState, setIsPanningState] = useState<boolean>(false);
  const panStartPointRef = useRef<Point | null>(null);
  const panStartViewBoxRef = useRef<{ x: number; y: number } | null>(null);

  const [isMovingElementState, setIsMovingElementState] = useState<boolean>(false);
  const movingElementOriginalStateRef = useRef<WhiteboardElement | null>(null);
  const movingChildrenOriginalStatesRef = useRef<WhiteboardElement[]>([]);
  const movingAttachedConnectorsOriginalStatesRef = useRef<ConnectorElement[]>([]);
  const mouseDownPointRef = useRef<Point | null>(null);

  const [activeResizeHandleState, setActiveResizeHandleState] = useState<ResizeHandleType | null>(null);
  const resizingElementOriginalRef = useRef<FlowchartShapeElement | EmojiElement | ImageElement | ContentBoxElement | GroupElement | null>(null); // Added GroupElement

  const [currentCursor, setCurrentCursor] = useState<string>('default');
  const lastClickTimeRef = useRef<number>(0);
  const lastClickedElementIdRef = useRef<string | null>(null);

  const [potentialSnapTarget, setPotentialSnapTarget] = useState<{ elementId: string; targetPoint: Point; targetPointIndex: number; } | null>(null);
  const [drawingConnectorState, setDrawingConnectorState] = useState<{
    startElementId: string;
    startPoint: Point;
    startPointIndex: number;
  } | null>(null);

  const aiHookRef = useRef<AiHook | null>(null);
  const mermaidHookRef = useRef<MermaidHook | null>(null);

  const [urlInputStep, setUrlInputStep] = useState<UrlInputStep>('idle');
  const [tempUrlData, setTempUrlData] = useState<TempUrlData | null>(null);


  const setAiHook = useCallback((hook: AiHook) => { aiHookRef.current = hook; }, []);
  const setMermaidHook = useCallback((hook: MermaidHook) => { mermaidHookRef.current = hook; }, []);

  const getMousePosition = useCallback((event: React.MouseEvent | React.TouchEvent<HTMLCanvasElement>, relativeToViewport: boolean = false): Point | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;
    if ('touches' in event) {
        if (event.touches.length === 0) return null;
        clientX = event.touches[0].clientX; clientY = event.touches[0].clientY;
    } else {
        clientX = event.clientX; clientY = event.clientY;
    }
    const viewportX = Math.max(0, Math.min(clientX - rect.left, canvasRenderWidth));
    const viewportY = Math.max(0, Math.min(clientY - rect.top, canvasRenderHeight));
    if(relativeToViewport) return {x: viewportX, y: viewportY};
    return toVirtualPos({x: viewportX, y: viewportY});
  }, [canvasRef, canvasRenderWidth, canvasRenderHeight, toVirtualPos]);

  const getConnectorHandleAtPoint = useCallback((element: WhiteboardElement, virtualClickPos: Point): { point: Point; index: number } | null => {
    if (element.type !== 'flowchart-shape' && element.type !== 'content-box' && element.type !== 'image' && element.type !== 'group') return null;
    const attachmentPointsWithIndices = getConnectorAttachmentPoints(element);
    const clickRadiusVirtual = CONNECTOR_HANDLE_RADIUS * 2.5;
    for (const item of attachmentPointsWithIndices) {
      const dist = Math.sqrt(Math.pow(virtualClickPos.x - item.point.x, 2) + Math.pow(virtualClickPos.y - item.point.y, 2));
      if (dist < clickRadiusVirtual) return item;
    }
    return null;
  }, []);

  const handleGenerateOrRegenerateElementSummary = useCallback(async (element: WhiteboardElement) => {
    if (!aiHookRef.current) return;
    const updatableElement = element as UpdatableAISummaryElement;
    if (!elementManager.updateElement || !aiHookRef.current.generateSummaryForElement) return;
    elementManager.updateElement({ ...updatableElement, aiSummaryLoading: true, aiSummaryVisible: false });
    try {
        const summary = await aiHookRef.current.generateSummaryForElement(updatableElement);
        elementManager.updateElement({ ...updatableElement, aiSummary: summary || "Summary unavailable.", aiSummaryLoading: false, aiSummaryVisible: true });
    } catch (e: any) {
        elementManager.updateElement({ ...updatableElement, aiSummary: `Error: ${e.message || "Could not generate summary."}`, aiSummaryLoading: false, aiSummaryVisible: true });
    }
  }, [elementManager]);

  const handleToggleElementSummaryVisibility = useCallback((element: WhiteboardElement) => {
      if (!elementManager.updateElement) return;
      const updatableElement = element as UpdatableAISummaryElement;
      if (updatableElement.aiSummary && updatableElement.aiSummary.trim() !== "" && !updatableElement.aiSummary.startsWith("Error:")) {
          elementManager.updateElement({ ...updatableElement, aiSummaryVisible: !updatableElement.aiSummaryVisible });
      }
  }, [elementManager]);

  const handleDoubleClick = useCallback((event: React.MouseEvent) => {
    if (currentTool === Tool.SELECT && !isCurrentlyEditingText && urlInputStep === 'idle') {
        const virtualPos = getMousePosition(event);
        if (!virtualPos) return;
        const ctx = canvasRef.current?.getContext('2d');
        if (!ctx) return;

        let clickedElement: WhiteboardElement | null = null;
        for (let i = elements.length - 1; i >= 0; i--) {
            if (isPointInElement(virtualPos, elements[i], ctx)) {
                clickedElement = elements[i];
                // If child of a group is double-clicked, still target the child for editing, not the group.
                break;
            }
        }

        if (clickedElement) {
            // If the actual clicked element is part of a group, select the group for single click,
            // but for double click, we want to edit the child if it's editable.
            const parentGroup = (clickedElement as any).groupId ? elements.find(el => el.id === (clickedElement as any).groupId && el.type === 'group') : null;
            if (parentGroup) {
                setSelectedElementId(parentGroup.id); // Select the group
            } else {
                 setSelectedElementId(clickedElement.id); // Select the item itself if not in a group or it is a group
            }

            if (clickedElement.type === 'flowchart-shape') {
                const vpPos = toViewportPos({ x: clickedElement.x + 2, y: clickedElement.y + 2 });
                startTextEditing({
                    x: vpPos.x, y: vpPos.y,
                    width: (clickedElement.width - 4) * zoomLevel,
                    height: (clickedElement.height - 4) * zoomLevel,
                    color: clickedElement.textColor,
                    fontSize: DEFAULT_FONT_SIZE * zoomLevel,
                    fontFamily: DEFAULT_FONT_FAMILY, initialText: clickedElement.text, centerText: true,
                    targetId: clickedElement.id,
                    backgroundColor: clickedElement.fillColor === TRANSPARENT_FILL_VALUE ? 'rgba(255,255,255,0.8)' : 'transparent',
                });
            } else if (clickedElement.type === 'text') {
                 const fontSizeVirtual = parseFloat(clickedElement.font) || DEFAULT_FONT_SIZE;
                 const fontFamily = clickedElement.font.split('px ')[1] || DEFAULT_FONT_FAMILY;
                 const vpPos = toViewportPos({ x: clickedElement.x, y: clickedElement.y });
                 startTextEditing({
                    x: vpPos.x, y: vpPos.y,
                    initialText: clickedElement.text,
                    color: clickedElement.color,
                    fontSize: fontSizeVirtual * zoomLevel,
                    fontFamily: fontFamily,
                    targetId: clickedElement.id
                 });
            } else if (clickedElement.type === 'content-box') {
                onEditContentBox(clickedElement);
            } else if (clickedElement.type === 'image' && clickedElement.mermaidSyntax && mermaidHookRef.current) {
                mermaidHookRef.current.openMermaidModal(clickedElement.mermaidSyntax, clickedElement.id);
            }
        }
    }
  }, [currentTool, getMousePosition, elements, startTextEditing, setSelectedElementId, onEditContentBox, isCurrentlyEditingText, urlInputStep, canvasRef, mermaidHookRef, toViewportPos, zoomLevel]);

  const handleCancelUrlInput = useCallback(() => {
    setUrlInputStep('idle');
    setTempUrlData(null);
    globalCancelTextEditing();
  }, [globalCancelTextEditing]);

  const handleSubmitUrlInput = useCallback((url: string) => {
    if (!tempUrlData) {
        handleCancelUrlInput();
        return;
    }
    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
        handleCancelUrlInput();
        return;
    }

    setTempUrlData(prev => ({ ...prev!, url: trimmedUrl }));
    setUrlInputStep('waitingForDisplayText');

    const vpClickPos = toViewportPos({x: tempUrlData.x, y: tempUrlData.y});
    const approxUrlInputHeight = (tempUrlData.fontSize * zoomLevel) + (10 * zoomLevel);

    const textInputConfig: TextInputConfig = {
      x: vpClickPos.x,
      y: vpClickPos.y + approxUrlInputHeight,
      initialText: '',
      color: tempUrlData.color,
      fontSize: tempUrlData.fontSize * zoomLevel,
      fontFamily: tempUrlData.fontFamily,
      placeholder: "Display Text (optional, Enter for URL)",
    };
    startTextEditing(textInputConfig, handleSubmitDisplayText, handleCancelUrlInput);
  }, [tempUrlData, startTextEditing, handleCancelUrlInput, zoomLevel, toViewportPos]);

  const handleSubmitDisplayText = useCallback((displayText: string) => {
    if (!tempUrlData || !tempUrlData.url) {
        handleCancelUrlInput();
        return;
    }

    const newUrlElement: UrlElement = {
      id: `url-${Date.now()}`,
      type: 'url',
      x: tempUrlData.x,
      y: tempUrlData.y,
      urlText: tempUrlData.url,
      displayText: displayText.trim() || undefined,
      color: tempUrlData.color,
      fontSize: tempUrlData.fontSize,
      fontFamily: tempUrlData.fontFamily,
    };
    addElement(newUrlElement);
    if (aiHookRef.current?.triggerAutomaticSummaryGeneration) {
      aiHookRef.current.triggerAutomaticSummaryGeneration(newUrlElement);
    }

    setUrlInputStep('idle');
    setTempUrlData(null);
    globalCancelTextEditing();
    setCurrentTool(Tool.SELECT);
    setSelectedElementId(newUrlElement.id);

  }, [tempUrlData, addElement, setCurrentTool, setSelectedElementId, globalCancelTextEditing]);

  const handleMouseDown = useCallback((event: React.MouseEvent | React.TouchEvent<HTMLCanvasElement>) => {
    if (currentTool === Tool.URL && urlInputStep === 'idle' && isCurrentlyEditingText) {
        globalCancelTextEditing();
    }
    if (isCurrentlyEditingText || urlInputStep !== 'idle') return;

    event.preventDefault();
    const viewportPosRaw = getMousePosition(event, true);
    if (!viewportPosRaw) return;
    const virtualPos = toVirtualPos(viewportPosRaw);
    mouseDownPointRef.current = virtualPos;

    if (!('touches' in event)) { // Double-click logic for mouse only
        const now = Date.now();
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx) {
            let clickedElForDoubleClick: WhiteboardElement | null = null;
            for (let i = elements.length - 1; i >= 0; i--) {
                if (isPointInElement(virtualPos, elements[i], ctx)) { clickedElForDoubleClick = elements[i]; break; }
            }
            if (now - lastClickTimeRef.current < 300 && clickedElForDoubleClick && clickedElForDoubleClick.id === lastClickedElementIdRef.current) {
                lastClickTimeRef.current = 0; lastClickedElementIdRef.current = null;
                handleDoubleClick(event as React.MouseEvent); return;
            }
            lastClickedElementIdRef.current = clickedElForDoubleClick?.id || null;
        }
        lastClickTimeRef.current = now;
    }

    const ctx = canvasRef.current?.getContext('2d');
    if (selectedElementId && currentTool === Tool.SELECT && ctx) {
        const currentSelectedElement = elements.find(el => el.id === selectedElementId);
        if (currentSelectedElement && currentSelectedElement.type !== 'connector') {
            const actionButtons = getElementSummaryActionButtons(currentSelectedElement, viewBoxX, viewBoxY, zoomLevel, ctx);
            for (const button of actionButtons) {
                if (viewportPosRaw.x >= button.x && viewportPosRaw.x <= button.x + button.width &&
                    viewportPosRaw.y >= button.y && viewportPosRaw.y <= button.y + button.height) {
                    if (button.type === 'regenerateSummary') handleGenerateOrRegenerateElementSummary(currentSelectedElement);
                    else if (button.type === 'showSummary' || button.type === 'hideSummary') handleToggleElementSummaryVisibility(currentSelectedElement);
                    else if (button.type === 'editMermaid' && currentSelectedElement.type === 'image' && currentSelectedElement.mermaidSyntax && mermaidHookRef.current) {
                        mermaidHookRef.current.openMermaidModal(currentSelectedElement.mermaidSyntax, currentSelectedElement.id);
                    }
                    return; // Action button click handled
                }
            }
        }
    }

    if (currentTool === Tool.PAN) {
        setIsPanningState(true);
        panStartPointRef.current = viewportPosRaw;
        panStartViewBoxRef.current = { x: viewBoxX, y: viewBoxY };
        setIsDrawingInteraction(true); setCurrentCursor('grabbing'); return;
    }

    if (currentTool === Tool.SELECT) {
        if (!ctx) return;
        const isShiftPressed = (event as React.MouseEvent).shiftKey;

        let topMostClickedElement: WhiteboardElement | null = null;
        for (let i = elements.length - 1; i >= 0; i--) {
            if (isPointInElement(virtualPos, elements[i], ctx)) { topMostClickedElement = elements[i]; break; }
        }

        let elementToInteractWith = topMostClickedElement;
        if (topMostClickedElement && (topMostClickedElement as any).groupId) {
            const parentGroup = elements.find(el => el.id === (topMostClickedElement as any).groupId && el.type === 'group');
            if (parentGroup) {
                elementToInteractWith = parentGroup;
            }
        }

        if (isShiftPressed && elementToInteractWith) {
            toggleMultiSelectElement(elementToInteractWith.id);
            return;
        } else if (isShiftPressed && !elementToInteractWith) {
            return;
        }

        const currentSelectedElementActual = selectedElementId ? elements.find(el => el.id === selectedElementId) : null;
        const startMove = (elementToStartMove: WhiteboardElement) => {
            setIsMovingElementState(true);
            movingElementOriginalStateRef.current = elementToStartMove;
            if (elementToStartMove.type === 'group') {
                movingChildrenOriginalStatesRef.current = (elementToStartMove as GroupElement).childElementIds.map(id => elements.find(el => el.id === id)).filter(Boolean) as WhiteboardElement[];
            }
            const elementIdsToFindAttachmentsFor = [elementToStartMove.id, ...movingChildrenOriginalStatesRef.current.map(c => c.id)];
            movingAttachedConnectorsOriginalStatesRef.current = elements.filter(el =>
                el.type === 'connector' && (elementIdsToFindAttachmentsFor.includes(el.startElementId || '') || elementIdsToFindAttachmentsFor.includes(el.endElementId || ''))
            ) as ConnectorElement[];
            setActiveResizeHandleState(null);
            setIsDrawingInteraction(true);
        };

        if (currentSelectedElementActual) {
            const isClickOnSelectedItselfOrChild = elementToInteractWith && elementToInteractWith.id === currentSelectedElementActual.id;

            if (currentSelectedElementActual.type !== 'connector') {
                 const handleType = getHandleAtPoint(viewportPosRaw, currentSelectedElementActual as any, ctx, viewBoxX, viewBoxY, zoomLevel);
                if (handleType && currentSelectedElementActual.type !== 'url') {
                    setActiveResizeHandleState(handleType);
                    resizingElementOriginalRef.current = currentSelectedElementActual as any;
                    setIsDrawingInteraction(true); return;
                }
            }
            if ((currentSelectedElementActual.type === 'flowchart-shape' || currentSelectedElementActual.type === 'content-box' || currentSelectedElementActual.type === 'image' || currentSelectedElementActual.type === 'group')) {
                const clickedConnectorHandle = getConnectorHandleAtPoint(currentSelectedElementActual, virtualPos);
                if (clickedConnectorHandle) {
                    setDrawingConnectorState({ startElementId: selectedElementId!, startPoint: clickedConnectorHandle.point, startPointIndex: clickedConnectorHandle.index });
                    setIsDrawingInteraction(true);
                    setDrawingInteractionStateInternal({ tool: Tool.ARROW, startPoint: clickedConnectorHandle.point, currentPoint: clickedConnectorHandle.point, elementId: selectedElementId });
                    return;
                }
            }

            if (isClickOnSelectedItselfOrChild) {
                startMove(currentSelectedElementActual);
            } else {
                setSelectedElementId(elementToInteractWith ? elementToInteractWith.id : null);
                if (elementToInteractWith) {
                    startMove(elementToInteractWith);
                } else {
                    setIsMovingElementState(false);
                }
            }
        } else {
             setSelectedElementId(elementToInteractWith ? elementToInteractWith.id : null);
            if (elementToInteractWith) {
                startMove(elementToInteractWith);
            } else {
                setIsMovingElementState(false);
            }
        }
        return;
    } else {
        setSelectedElementId(null); setActiveResizeHandleState(null);
        setIsMovingElementState(false);
    }
    
    if (currentTool === Tool.TEXT) {
        const newContentBox: ContentBoxElement = {
            id: `textbox-${Date.now()}`, type: 'content-box',
            x: virtualPos.x, y: virtualPos.y,
            width: DEFAULT_ONSCREEN_TEXT_BOX_WIDTH, height: DEFAULT_ONSCREEN_TEXT_BOX_HEIGHT,
            contentType: 'plaintext', filename: undefined, content: "",
            backgroundColor: TRANSPARENT_FILL_VALUE, textColor: currentColor,
            fontSize: DEFAULT_CONTENT_BOX_FONT_SIZE,
        };
        addElement(newContentBox);
        if (aiHookRef.current?.triggerAutomaticSummaryGeneration) aiHookRef.current.triggerAutomaticSummaryGeneration(newContentBox);
        onEditContentBox(newContentBox);
        setCurrentTool(Tool.SELECT); setSelectedElementId(newContentBox.id); return;
    } else if (currentTool === Tool.URL) {
        setUrlInputStep('waitingForUrl');
        setTempUrlData({
            x: virtualPos.x,
            y: virtualPos.y,
            color: currentColor,
            fontSize: DEFAULT_FONT_SIZE,
            fontFamily: DEFAULT_FONT_FAMILY,
        });
        const vpClickPos = toViewportPos(virtualPos);
        const textInputConfig: TextInputConfig = {
            x: vpClickPos.x,
            y: vpClickPos.y,
            initialText: '',
            color: currentColor,
            fontSize: DEFAULT_FONT_SIZE * zoomLevel,
            fontFamily: DEFAULT_FONT_FAMILY,
            placeholder: "Enter URL (e.g., https://example.com)",
        };
        startTextEditing(textInputConfig, handleSubmitUrlInput, handleCancelUrlInput);
        return;
    } else if (currentTool === Tool.EMOJI_STAMP && selectedEmojiStamp) {
        const newEmojiElement: EmojiElement = {
            id: `emoji-${Date.now()}`, type: 'emoji', emojiChar: selectedEmojiStamp,
            x: virtualPos.x - (DEFAULT_EMOJI_SIZE / 2), y: virtualPos.y - (DEFAULT_EMOJI_SIZE / 2),
            size: DEFAULT_EMOJI_SIZE,
        };
        addElement(newEmojiElement);
        if (aiHookRef.current?.triggerAutomaticSummaryGeneration) aiHookRef.current.triggerAutomaticSummaryGeneration(newEmojiElement);
        setCurrentTool(Tool.SELECT); setSelectedElementId(newEmojiElement.id); return;
    }

    if (currentTool === Tool.PENCIL) {
        setIsDrawingInteraction(true); setCurrentPathPointsState([virtualPos]);
        setDrawingInteractionStateInternal({ tool: Tool.PENCIL, startPoint: virtualPos, currentPoint: virtualPos });
    } else if (currentTool === Tool.ERASER) {
        setIsDrawingInteraction(true);
    } else if (
        currentTool === Tool.RECTANGLE || currentTool === Tool.OVAL || currentTool === Tool.DIAMOND ||
        currentTool === Tool.TRIANGLE || currentTool === Tool.PARALLELOGRAM || currentTool === Tool.HEXAGON ||
        currentTool === Tool.CYLINDER || currentTool === Tool.CLOUD || currentTool === Tool.STAR ||
        currentTool === Tool.ARROW
    ) {
        setIsDrawingInteraction(true);
        let initialStartElementId: string | undefined = undefined;
        let initialStartAttachmentPointIndex: number | undefined = undefined;
        let finalStartPoint = virtualPos;

        if (currentTool === Tool.ARROW) {
            for (const el of elements) {
                if (el.type === 'flowchart-shape' || el.type === 'content-box' || el.type === 'image' || el.type === 'group') {
                    const attachmentPointsWithIndices = getConnectorAttachmentPoints(el);
                    for (const item of attachmentPointsWithIndices) {
                        const dist = Math.sqrt(Math.pow(virtualPos.x - item.point.x, 2) + Math.pow(virtualPos.y - item.point.y, 2));
                        if (dist < (CONNECTOR_SNAP_PROXIMITY_THRESHOLD)) {
                            initialStartElementId = el.id; initialStartAttachmentPointIndex = item.index;
                            finalStartPoint = item.point; break;
                        }
                    }
                }
                if (initialStartElementId) break;
            }
        }
        setDrawingInteractionStateInternal({ tool: currentTool, startPoint: finalStartPoint, currentPoint: finalStartPoint, _internal_initialStartElementId: initialStartElementId, _internal_initialStartAttachmentPointIndex: initialStartAttachmentPointIndex });
    }
  }, [currentTool, getMousePosition, toVirtualPos, isCurrentlyEditingText, urlInputStep, globalCancelTextEditing, viewBoxX, viewBoxY, zoomLevel, selectedElementId, elements, setSelectedElementId, startTextEditing, currentColor, selectedEmojiStamp, addElement, setCurrentTool, canvasRef, onEditContentBox, handleDoubleClick, getConnectorHandleAtPoint, handleGenerateOrRegenerateElementSummary, handleToggleElementSummaryVisibility, currentStrokeWidth, useTransparentFill, currentLineStyle, mermaidHookRef, toViewportPos, panCanvas, handleSubmitUrlInput, handleCancelUrlInput, handleSubmitDisplayText, toggleMultiSelectElement, clearMultiSelection, aiHookRef]);

  const handleMouseMove = useCallback((event: React.MouseEvent | React.TouchEvent<HTMLCanvasElement>) => {
    if (urlInputStep !== 'idle') return;

    const viewportPosRaw = getMousePosition(event, true);
    if (!viewportPosRaw) return;
    const virtualPos = toVirtualPos(viewportPosRaw);
    const ctx = canvasRef.current?.getContext('2d');

    // Cursor update logic
    let cursorToSet = 'crosshair';
    if (currentTool === Tool.SELECT && ctx) {
        cursorToSet = 'default';
        const currentSelectedEl = selectedElementId ? elements.find(el => el.id === selectedElementId) : null;
        if (currentSelectedEl && currentSelectedEl.type !== 'connector') {
            const actionButtons = getElementSummaryActionButtons(currentSelectedEl, viewBoxX, viewBoxY, zoomLevel, ctx);
            let buttonHovered = false;
            for (const button of actionButtons) {
                 if (viewportPosRaw.x >= button.x && viewportPosRaw.x <= button.x + button.width && viewportPosRaw.y >= button.y && viewportPosRaw.y <= button.y + button.height) {
                    cursorToSet = 'pointer'; buttonHovered = true; break;
                }
            }
            if (!buttonHovered && currentCursor === 'pointer') setCurrentCursor('default');
        }

        if (cursorToSet === 'default') {
            if (isDrawingInteraction && isMovingElementState) cursorToSet = 'move';
            else if (drawingConnectorState) cursorToSet = 'crosshair';
            else if (currentSelectedEl) {
                if (currentSelectedEl.type !== 'url') {
                    const handleType = getHandleAtPoint(viewportPosRaw, currentSelectedEl as any, ctx, viewBoxX, viewBoxY, zoomLevel);
                    if (handleType) {
                        const handles = getResizeHandles(currentSelectedEl as any, ctx, viewBoxX, viewBoxY, zoomLevel);
                        cursorToSet = handles.find(h => h.type === handleType)?.cursor || 'default';
                    } else if (isPointInElement(virtualPos, currentSelectedEl, ctx)) cursorToSet = 'move';
                } else if (isPointInElement(virtualPos, currentSelectedEl, ctx)) cursorToSet = 'move';

                if (cursorToSet === 'default' && (currentSelectedEl.type === 'flowchart-shape' || currentSelectedEl.type === 'content-box' || currentSelectedEl.type === 'image' || currentSelectedEl.type === 'group')) {
                     const connectorHandle = getConnectorHandleAtPoint(currentSelectedEl, virtualPos);
                    if (connectorHandle) cursorToSet = 'crosshair';
                }

            } else {
                let hoveredElement: WhiteboardElement | null = null;
                for (let i = elements.length - 1; i >= 0; i--) {
                    if (isPointInElement(virtualPos, elements[i], ctx)) { hoveredElement = elements[i]; break; }
                }
                if (hoveredElement) cursorToSet = 'pointer';
            }
        }
    } else if (currentTool === Tool.PAN) cursorToSet = isPanningState ? 'grabbing' : 'grab';
    else if (currentTool === Tool.TEXT || currentTool === Tool.URL) cursorToSet = 'text';
    else if (currentTool === Tool.ERASER) cursorToSet = 'crosshair';
    else if (currentTool === Tool.EMOJI_STAMP) cursorToSet = 'copy';
    if (currentCursor !== 'pointer' || cursorToSet === 'pointer') setCurrentCursor(cursorToSet);

    // Snap target logic
    const isDrawingArrowLike = isDrawingInteraction && (drawingInteractionStateInternal?.tool === Tool.ARROW || drawingConnectorState);
    if (isDrawingArrowLike) {
        let foundSnapTargetThisMove = false;
        for (const el of elements) {
            if (drawingConnectorState && el.id === drawingConnectorState.startElementId) continue;
            if (drawingInteractionStateInternal?._internal_initialStartElementId && el.id === drawingInteractionStateInternal._internal_initialStartElementId) continue;
            if (el.type === 'flowchart-shape' || el.type === 'content-box' || el.type === 'image' || el.type === 'group') {
                const attachmentPointsWithIndices = getConnectorAttachmentPoints(el);
                for (const item of attachmentPointsWithIndices) {
                    const dist = Math.sqrt(Math.pow(virtualPos.x - item.point.x, 2) + Math.pow(virtualPos.y - item.point.y, 2));
                    if (dist < (CONNECTOR_SNAP_PROXIMITY_THRESHOLD)) {
                        setPotentialSnapTarget({ elementId: el.id, targetPoint: item.point, targetPointIndex: item.index });
                        foundSnapTargetThisMove = true; break;
                    }
                }
            }
            if (foundSnapTargetThisMove) break;
        }
        if (!foundSnapTargetThisMove) setPotentialSnapTarget(null);
    } else if (!isDrawingInteraction && potentialSnapTarget !== null) setPotentialSnapTarget(null);

    if (!isDrawingInteraction) return;

    if (isPanningState && panStartPointRef.current && panStartViewBoxRef.current) {
        const deltaXScreen = viewportPosRaw.x - panStartPointRef.current.x;
        const deltaYScreen = viewportPosRaw.y - panStartPointRef.current.y;
        panCanvas(deltaXScreen, deltaYScreen, panStartViewBoxRef.current);
        return;
    }

    if (isMovingElementState && selectedElementId && mouseDownPointRef.current && movingElementOriginalStateRef.current) {
        const deltaX = virtualPos.x - mouseDownPointRef.current.x;
        const deltaY = virtualPos.y - mouseDownPointRef.current.y;

        const elementsToUpdate = new Map<string, WhiteboardElement>();
        
        const mainElement = movingElementOriginalStateRef.current;
        const children = movingChildrenOriginalStatesRef.current;
        const connectors = movingAttachedConnectorsOriginalStatesRef.current;
        
        const elementsBeingMoved = [mainElement, ...children];

        elementsBeingMoved.forEach(originalElement => {
            let newElementState: WhiteboardElement;
             if (originalElement.type === 'path') {
                newElementState = { ...originalElement, points: originalElement.points.map(p => ({ x: p.x + deltaX, y: p.y + deltaY })) };
            } else if (originalElement.type === 'connector') {
                newElementState = { ...originalElement, startPoint: { x: originalElement.startPoint.x + deltaX, y: originalElement.startPoint.y + deltaY }, endPoint: { x: originalElement.endPoint.x + deltaX, y: originalElement.endPoint.y + deltaY }};
            } else {
                newElementState = { ...originalElement, x: (originalElement as any).x + deltaX, y: (originalElement as any).y + deltaY };
            }
            elementsToUpdate.set(originalElement.id, newElementState);
        });

        const groupBeingMoved = mainElement.type === 'group' ? (elementsToUpdate.get(mainElement.id) as GroupElement) : null;
        
        connectors.forEach(originalConnector => {
            let needsUpdate = false;
            let updatedConnector = { ...originalConnector,
                startPoint: { x: originalConnector.startPoint.x + deltaX, y: originalConnector.startPoint.y + deltaY },
                endPoint: { x: originalConnector.endPoint.x + deltaX, y: originalConnector.endPoint.y + deltaY }
            };

            const startElId = originalConnector.startElementId;
            const endElId = originalConnector.endElementId;

            if (startElId && elementsToUpdate.has(startElId)) {
                const newStartElement = elementsToUpdate.get(startElId)!;
                const attachmentPoints = getConnectorAttachmentPoints(newStartElement);
                const newStartPoint = attachmentPoints.find(p => p.index === originalConnector.startAttachmentPointIndex)?.point;
                if (newStartPoint) {
                    updatedConnector.startPoint = newStartPoint;
                    needsUpdate = true;
                }
            }
            if (endElId && elementsToUpdate.has(endElId)) {
                const newEndElement = elementsToUpdate.get(endElId)!;
                const attachmentPoints = getConnectorAttachmentPoints(newEndElement);
                const newEndPoint = attachmentPoints.find(p => p.index === originalConnector.endAttachmentPointIndex)?.point;
                if (newEndPoint) {
                    updatedConnector.endPoint = newEndPoint;
                    needsUpdate = true;
                }
            }
            elementsToUpdate.set(updatedConnector.id, updatedConnector);
        });

        setElements(prevElements => prevElements.map(el => elementsToUpdate.get(el.id) || el));

    } else if (activeResizeHandleState && selectedElementId && resizingElementOriginalRef.current && mouseDownPointRef.current && ctx) {
        const deltaX = virtualPos.x - mouseDownPointRef.current.x;
        const deltaY = virtualPos.y - mouseDownPointRef.current.y;
        const originalShapeOrGroup = resizingElementOriginalRef.current;
        let currentElementToUpdate = getElementById(selectedElementId);
        if (!currentElementToUpdate || (currentElementToUpdate.type !== 'flowchart-shape' && currentElementToUpdate.type !== 'emoji' && currentElementToUpdate.type !== 'image' && currentElementToUpdate.type !== 'content-box' && currentElementToUpdate.type !== 'group')) return;

        let updatedResizedElementProperties: Partial<WhiteboardElement> = {};

        if ((currentElementToUpdate.type === 'flowchart-shape' && originalShapeOrGroup.type === 'flowchart-shape') ||
            (currentElementToUpdate.type === 'content-box' && originalShapeOrGroup.type === 'content-box') ||
            (currentElementToUpdate.type === 'group' && originalShapeOrGroup.type === 'group')
        ) {
            let { x: newX, y: newY, width: newWidth, height: newHeight } = originalShapeOrGroup as FlowchartShapeElement | ContentBoxElement | GroupElement;
            const minSize = currentElementToUpdate.type === 'content-box' ? MIN_CONTENT_BOX_SIZE : (currentElementToUpdate.type === 'group' ? MIN_SHAPE_SIZE : MIN_SHAPE_SIZE); // Group min size like shape
            switch (activeResizeHandleState) {
                case 'nw': newX += deltaX; newY += deltaY; newWidth -= deltaX; newHeight -= deltaY; break;
                case 'n': newY += deltaY; newHeight -= deltaY; break;
                case 'ne': newY += deltaY; newWidth += deltaX; newHeight -= deltaY; break;
                case 'w': newX += deltaX; newWidth -= deltaX; break;
                case 'e': newWidth += deltaX; break;
                case 'sw': newX += deltaX; newWidth -= deltaX; newHeight += deltaY; break;
                case 's': newHeight += deltaY; break;
                case 'se': newWidth += deltaX; newHeight += deltaY; break;
            }
            if (newWidth < minSize) { if (activeResizeHandleState.includes('w')) newX = newX + newWidth - minSize; newWidth = minSize;}
            if (newHeight < minSize) { if (activeResizeHandleState.includes('n')) newY = newY + newHeight - minSize; newHeight = minSize;}
            updatedResizedElementProperties = { ...currentElementToUpdate, x: newX, y: newY, width: newWidth, height: newHeight };
        } else if (currentElementToUpdate.type === 'emoji' && originalShapeOrGroup.type === 'emoji') {
            const bbox = getElementBoundingBox(originalShapeOrGroup, ctx); if (!bbox) return;
            const centerX = bbox.x + bbox.width / 2; const centerY = bbox.y + bbox.height / 2;
            const originalDistToCorner = { x: (activeResizeHandleState.includes('e') ? bbox.width : -bbox.width) / 2, y: (activeResizeHandleState.includes('s') ? bbox.height : -bbox.height) / 2 };
            const currentVirtualMouseRelativeToCenter = { x: virtualPos.x - centerX, y: virtualPos.y - centerY };
            let scaleX = 1, scaleY = 1;
            if (Math.abs(originalDistToCorner.x) > 1) scaleX = currentVirtualMouseRelativeToCenter.x / originalDistToCorner.x;
            if (Math.abs(originalDistToCorner.y) > 1) scaleY = currentVirtualMouseRelativeToCenter.y / originalDistToCorner.y;
            let scaleFactor = 1;
            if (activeResizeHandleState === 'nw' || activeResizeHandleState === 'ne' || activeResizeHandleState === 'sw' || activeResizeHandleState === 'se') scaleFactor = Math.max(Math.abs(scaleX), Math.abs(scaleY));
            else if (activeResizeHandleState === 'n' || activeResizeHandleState === 's') scaleFactor = Math.abs(scaleY);
            else if (activeResizeHandleState === 'w' || activeResizeHandleState === 'e') scaleFactor = Math.abs(scaleX);
            let newSize = Math.max(MIN_EMOJI_SIZE, (originalShapeOrGroup as EmojiElement).size * scaleFactor);
            const newBboxEstimate = { width: bbox.width * (newSize / (originalShapeOrGroup as EmojiElement).size), height: bbox.height * (newSize / (originalShapeOrGroup as EmojiElement).size) };
            let newX = (originalShapeOrGroup as EmojiElement).x; let newY = (originalShapeOrGroup as EmojiElement).y;
            if (activeResizeHandleState.includes('w')) newX = (originalShapeOrGroup as EmojiElement).x + bbox.width - newBboxEstimate.width;
            if (activeResizeHandleState.includes('n')) newY = (originalShapeOrGroup as EmojiElement).y + bbox.height - newBboxEstimate.height;
            updatedResizedElementProperties = { ...currentElementToUpdate, x: newX, y: newY, size: newSize };
        } else if (currentElementToUpdate.type === 'image' && originalShapeOrGroup.type === 'image') {
             let { x: origX, y: origY, width: origW, height: origH, naturalWidth, naturalHeight } = originalShapeOrGroup as ImageElement;
            const aspectRatio = naturalWidth / naturalHeight; let newX = origX, newY = origY, newW = origW, newH = origH;
            switch (activeResizeHandleState) {
                case 'se': newW = Math.max(MIN_IMAGE_SIZE, origW + deltaX); newH = newW / aspectRatio; break;
                case 'sw': newW = Math.max(MIN_IMAGE_SIZE, origW - deltaX); newH = newW / aspectRatio; newX = origX + (origW - newW); break;
                case 'ne': newW = Math.max(MIN_IMAGE_SIZE, origW + deltaX); newH = newW / aspectRatio; newY = origY + (origH - newH); break;
                case 'nw': newW = Math.max(MIN_IMAGE_SIZE, origW - deltaX); newH = newW / aspectRatio; newX = origX + (origW - newW); newY = origY + (origH - newH); break;
                case 'n': newH = Math.max(MIN_IMAGE_SIZE, origH - deltaY); newW = newH * aspectRatio; newY = origY + deltaY; newX = origX + (origW - newW) / 2; break;
                case 's': newH = Math.max(MIN_IMAGE_SIZE, origH + deltaY); newW = newH * aspectRatio; newX = origX + (origW - newW) / 2; break;
                case 'w': newW = Math.max(MIN_IMAGE_SIZE, origW - deltaX); newH = newW / aspectRatio; newX = origX + deltaX; newY = origY + (origH - newH) / 2; break;
                case 'e': newW = Math.max(MIN_IMAGE_SIZE, origW + deltaX); newH = newW / aspectRatio; newY = origY + (origH - newH) / 2; break;
            }
            if (newW < MIN_IMAGE_SIZE) { newW = MIN_IMAGE_SIZE; newH = newW / aspectRatio; if (activeResizeHandleState.includes('w')) newX = origX + (origW - newW); if (activeResizeHandleState === 'n' || activeResizeHandleState === 's') newX = origX + (origW - newW) / 2; }
            if (newH < MIN_IMAGE_SIZE) { newH = MIN_IMAGE_SIZE; newW = newH * aspectRatio; if (activeResizeHandleState.includes('n')) newY = origY + (origH - newH); if (activeResizeHandleState === 'w' || activeResizeHandleState === 'e') newY = origY + (origH - newH) / 2; }
            updatedResizedElementProperties = { ...currentElementToUpdate, x: newX, y: newY, width: newW, height: newH };
        }

        if (Object.keys(updatedResizedElementProperties).length > 0) {
            updateElement(updatedResizedElementProperties as WhiteboardElement);
            const newlyResizedElement = { ...currentElementToUpdate, ...updatedResizedElementProperties } as WhiteboardElement;
            if (newlyResizedElement.type === 'flowchart-shape' || newlyResizedElement.type === 'image' || newlyResizedElement.type === 'content-box' || newlyResizedElement.type === 'group') {
                const currentElementsSnapshot = elementManager.elements;
                const resizedElementAttachmentPoints = getConnectorAttachmentPoints(newlyResizedElement);
                currentElementsSnapshot.forEach(el => {
                    if (el.type === 'connector') {
                        let connectorToUpdate = { ...el }; let needsConnectorUpdate = false;
                        if (el.startElementId === selectedElementId && typeof el.startAttachmentPointIndex === 'number') {
                            const newStartPoint = resizedElementAttachmentPoints.find(p => p.index === el.startAttachmentPointIndex)?.point;
                            if (newStartPoint && (newStartPoint.x !== el.startPoint.x || newStartPoint.y !== el.startPoint.y)) { connectorToUpdate.startPoint = newStartPoint; needsConnectorUpdate = true; }
                        }
                        if (el.endElementId === selectedElementId && typeof el.endAttachmentPointIndex === 'number') {
                            const newEndPoint = resizedElementAttachmentPoints.find(p => p.index === el.endAttachmentPointIndex)?.point;
                            if (newEndPoint && (newEndPoint.x !== el.endPoint.x || newEndPoint.y !== el.endPoint.y)) { connectorToUpdate.endPoint = newEndPoint; needsConnectorUpdate = true; }
                        }
                        if (needsConnectorUpdate) updateElement(connectorToUpdate);
                    }
                });
            }
        }

    } else if (currentTool === Tool.PENCIL) {
        setCurrentPathPointsState(prevPoints => [...prevPoints, virtualPos]);
    } else if (currentTool === Tool.ERASER && ctx) {
        const elementsToDelete = new Set<string>();
        const eraserVirtualWidth = ERASER_STROKE_WIDTH;
        elements.forEach(element => {
            const elementBox = getElementBoundingBox(element, ctx); if (!elementBox) return;
            const eraserHitArea = { x: virtualPos.x - eraserVirtualWidth / 2, y: virtualPos.y - eraserVirtualWidth / 2, width: eraserVirtualWidth, height: eraserVirtualWidth };
            if (doBoundingBoxesIntersect(elementBox, eraserHitArea)) elementsToDelete.add(element.id);
        });
        if (elementsToDelete.size > 0) elementsToDelete.forEach(id => removeElement(id));
    } else if (drawingInteractionStateInternal) {
        setDrawingInteractionStateInternal(prev => prev ? { ...prev, currentPoint: virtualPos } : null);
    }
  }, [getMousePosition, toVirtualPos, currentTool, isDrawingInteraction, isMovingElementState, selectedElementId, elements, viewBoxX, viewBoxY, zoomLevel, isPanningState, panCanvas, updateElement, activeResizeHandleState, removeElement, canvasRef, drawingInteractionStateInternal, potentialSnapTarget, drawingConnectorState, getConnectorHandleAtPoint, elementManager, getElementById, currentCursor, urlInputStep, movingChildrenOriginalStatesRef, resizingElementOriginalRef, setElements, commitBatchUpdate]);

  const handleMouseUp = useCallback((event: React.MouseEvent | React.TouchEvent<HTMLCanvasElement>) => {
    if (urlInputStep !== 'idle') {
        return;
    }

    const virtualPosUp = getMousePosition(event);
    const finalVirtualPos = virtualPosUp || drawingInteractionStateInternal?.currentPoint || mouseDownPointRef.current;

    if (isPanningState) {
        setIsPanningState(false); panStartPointRef.current = null; panStartViewBoxRef.current = null;
        setCurrentCursor(currentTool === Tool.PAN ? 'grab' : (currentTool === Tool.SELECT ? 'default' : 'crosshair'));
    }

    const elementBeingManipulatedId = selectedElementId;

    if (isMovingElementState && elementBeingManipulatedId && movingElementOriginalStateRef.current) {
        const originalStates = [
            movingElementOriginalStateRef.current,
            ...movingChildrenOriginalStatesRef.current,
            ...movingAttachedConnectorsOriginalStatesRef.current
        ];
        const originalStateIds = new Set(originalStates.map(el => el.id));
        const finalStates = elementManager.elements.filter(el => originalStateIds.has(el.id));
        
        if (originalStates.length === finalStates.length && finalStates.length > 0) {
            commitBatchUpdate(originalStates, finalStates);
        }

        const movedElement = getElementById(elementBeingManipulatedId) as UpdatableAISummaryElement | undefined;
        if (movedElement && aiHookRef.current?.triggerAutomaticSummaryGeneration && (!movedElement.aiSummary || movedElement.aiSummary.startsWith("Error:"))) {
            aiHookRef.current.triggerAutomaticSummaryGeneration(movedElement);
        }
        if (movedElement?.type === 'group') {
            (movedElement as GroupElement).childElementIds.forEach(childId => {
                const child = getElementById(childId) as UpdatableAISummaryElement | undefined;
                if (child && aiHookRef.current?.triggerAutomaticSummaryGeneration && (!child.aiSummary || child.aiSummary.startsWith("Error:"))) {
                    aiHookRef.current.triggerAutomaticSummaryGeneration(child);
                }
            });
        }
    } else if (activeResizeHandleState && elementBeingManipulatedId && resizingElementOriginalRef.current && finalVirtualPos && mouseDownPointRef.current) {
        const resizedElement = getElementById(elementBeingManipulatedId) as UpdatableAISummaryElement | undefined;
        if (resizedElement && aiHookRef.current?.triggerAutomaticSummaryGeneration) {
            const origBbox = getElementBoundingBox(resizingElementOriginalRef.current!, canvasRef.current?.getContext('2d') || null);
            const finalBbox = getElementBoundingBox(resizedElement, canvasRef.current?.getContext('2d') || null);
            if (origBbox && finalBbox && (Math.abs(origBbox.width - finalBbox.width) > 5 || Math.abs(origBbox.height - finalBbox.height) > 5)) {
                if (!resizedElement.aiSummary || resizedElement.aiSummary.startsWith("Error:")) aiHookRef.current.triggerAutomaticSummaryGeneration(resizedElement);
            }
        }
    }

    setIsMovingElementState(false);
    setActiveResizeHandleState(null);
    movingElementOriginalStateRef.current = null;
    movingChildrenOriginalStatesRef.current = [];
    movingAttachedConnectorsOriginalStatesRef.current = [];
    resizingElementOriginalRef.current = null;

    if (drawingConnectorState && drawingInteractionStateInternal && finalVirtualPos) {
        const endPoint = potentialSnapTarget ? potentialSnapTarget.targetPoint : finalVirtualPos;
        const newConnector: ConnectorElement = {
            id: `connector-${Date.now()}`, type: 'connector', startPoint: drawingConnectorState.startPoint, endPoint: endPoint,
            color: currentColor, strokeWidth: currentStrokeWidth, lineStyle: currentLineStyle,
            startElementId: drawingConnectorState.startElementId, startAttachmentPointIndex: drawingConnectorState.startPointIndex,
            endElementId: potentialSnapTarget ? potentialSnapTarget.elementId : undefined, endAttachmentPointIndex: potentialSnapTarget ? potentialSnapTarget.targetPointIndex : undefined,
        };
        addElement(newConnector); setDrawingConnectorState(null); setPotentialSnapTarget(null);
    } else if (isDrawingInteraction && currentTool === Tool.PENCIL) {
        if (currentPathPointsState.length > 1) {
            const newElement: PathElement = { id: Date.now().toString(), type: 'path', points: [...currentPathPointsState], color: currentColor, strokeWidth: currentStrokeWidth };
            addElement(newElement);
            if (aiHookRef.current?.triggerAutomaticSummaryGeneration) aiHookRef.current.triggerAutomaticSummaryGeneration(newElement);
        }
        setCurrentPathPointsState([]);
    } else if (drawingInteractionStateInternal && finalVirtualPos) {
        const { tool, startPoint, _internal_initialStartElementId, _internal_initialStartAttachmentPointIndex } = drawingInteractionStateInternal;
        const id = `${tool.toLowerCase()}-${Date.now()}`;
        let width = Math.abs(startPoint.x - finalVirtualPos.x);
        let height = Math.abs(startPoint.y - finalVirtualPos.y);
        const x = Math.min(startPoint.x, finalVirtualPos.x);
        const y = Math.min(startPoint.y, finalVirtualPos.y);
        const isShapeTool = tool === Tool.RECTANGLE || tool === Tool.OVAL || tool === Tool.DIAMOND || tool === Tool.TRIANGLE || tool === Tool.PARALLELOGRAM || tool === Tool.HEXAGON || tool === Tool.CYLINDER || tool === Tool.CLOUD || tool === Tool.STAR;
        if (width < MIN_SHAPE_SIZE && height < MIN_SHAPE_SIZE && tool !== Tool.ARROW) { width = DEFAULT_SHAPE_WIDTH / 1.5; height = DEFAULT_SHAPE_HEIGHT / 1.5; }
        else if (width < MIN_SHAPE_SIZE && isShapeTool) width = MIN_SHAPE_SIZE;
        else if (height < MIN_SHAPE_SIZE && isShapeTool) height = MIN_SHAPE_SIZE;
        if (isShapeTool) {
            const newShape: FlowchartShapeElement = {
                id, type: 'flowchart-shape', shapeType: tool.toLowerCase() as ShapeType, x, y, width, height, text: '',
                fillColor: useTransparentFill ? TRANSPARENT_FILL_VALUE : currentColor,
                borderColor: useTransparentFill ? currentColor : DEFAULT_SHAPE_BORDER_COLOR,
                strokeWidth: currentStrokeWidth, textColor: useTransparentFill ? currentColor : getTextColorForBackground(currentColor),
            };
            addElement(newShape);
            if (aiHookRef.current?.triggerAutomaticSummaryGeneration) aiHookRef.current.triggerAutomaticSummaryGeneration(newShape);
            setSelectedElementId(id);
            const vpPos = toViewportPos({ x: newShape.x + 2, y: newShape.y + 2 });
            startTextEditing({
                x: vpPos.x, y: vpPos.y,
                width: (newShape.width - 4) * zoomLevel, height: (newShape.height - 4) * zoomLevel,
                color: newShape.textColor, fontSize: DEFAULT_FONT_SIZE * zoomLevel,
                fontFamily: DEFAULT_FONT_FAMILY, initialText: '', centerText: true,
                targetId: id, backgroundColor: useTransparentFill ? 'rgba(255,255,255,0.8)' : 'transparent',
            });
        } else if (tool === Tool.ARROW) {
            if (width > 5 || height > 5 || potentialSnapTarget || _internal_initialStartElementId) {
                const finalEndPoint = potentialSnapTarget ? potentialSnapTarget.targetPoint : finalVirtualPos;
                const newConnector: ConnectorElement = {
                    id, type: 'connector', startPoint: startPoint, endPoint: finalEndPoint, color: currentColor, strokeWidth: currentStrokeWidth,
                    lineStyle: currentLineStyle, startElementId: _internal_initialStartElementId, startAttachmentPointIndex: _internal_initialStartAttachmentPointIndex,
                    endElementId: potentialSnapTarget ? potentialSnapTarget.elementId : undefined, endAttachmentPointIndex: potentialSnapTarget ? potentialSnapTarget.targetPointIndex : undefined,
                };
                addElement(newConnector);
            }
            setPotentialSnapTarget(null);
        }
    }
    setIsDrawingInteraction(false); setDrawingInteractionStateInternal(null);
    setDrawingConnectorState(null); mouseDownPointRef.current = null;
  }, [isDrawingInteraction, currentTool, currentPathPointsState, addElement, currentColor, currentStrokeWidth, currentLineStyle, drawingInteractionStateInternal, isPanningState, useTransparentFill, setSelectedElementId, startTextEditing, getMousePosition, potentialSnapTarget, setPotentialSnapTarget, drawingConnectorState, toolManager, aiHookRef, getElementById, canvasRef, activeResizeHandleState, isMovingElementState, selectedElementId, toViewportPos, zoomLevel, urlInputStep, elementManager, commitBatchUpdate]);

  const handleMouseLeave = useCallback(() => {
    if (urlInputStep !== 'idle') return;

    if (isMovingElementState) {
        const originalStates = [
            movingElementOriginalStateRef.current!,
            ...movingChildrenOriginalStatesRef.current,
            ...movingAttachedConnectorsOriginalStatesRef.current
        ].filter(Boolean);
        const originalStateIds = new Set(originalStates.map(el => el.id));
        const finalStates = elementManager.elements.filter(el => originalStateIds.has(el.id));
        
        if (originalStates.length === finalStates.length && finalStates.length > 0) {
            commitBatchUpdate(originalStates, finalStates);
        }
    }


    if (drawingConnectorState) {
        setDrawingConnectorState(null); setDrawingInteractionStateInternal(null);
        setPotentialSnapTarget(null); setIsDrawingInteraction(false);
        setCurrentCursor('default'); return;
    }
    if (isDrawingInteraction) {
      if (isPanningState) { setIsPanningState(false); panStartPointRef.current = null; panStartViewBoxRef.current = null; }
      if (currentTool === Tool.PENCIL && currentPathPointsState.length > 1) {
         const newElement: PathElement = { id: Date.now().toString(), type: 'path', points: [...currentPathPointsState], color: currentColor, strokeWidth: currentStrokeWidth };
        addElement(newElement);
        if (aiHookRef.current?.triggerAutomaticSummaryGeneration) aiHookRef.current.triggerAutomaticSummaryGeneration(newElement);
      } else if (drawingInteractionStateInternal) {
         const { tool, startPoint, currentPoint, _internal_initialStartElementId, _internal_initialStartAttachmentPointIndex } = drawingInteractionStateInternal;
         const finalPos = potentialSnapTarget ? potentialSnapTarget.targetPoint : currentPoint;
         const id = `${tool.toLowerCase()}-${Date.now()}`;
         let width = Math.abs(startPoint.x - finalPos.x); let height = Math.abs(startPoint.y - finalPos.y);
         const x = Math.min(startPoint.x, finalPos.x); const y = Math.min(startPoint.y, finalPos.y);
         const isShapeTool = tool === Tool.RECTANGLE || tool === Tool.OVAL || tool === Tool.DIAMOND || tool === Tool.TRIANGLE || tool === Tool.PARALLELOGRAM || tool === Tool.HEXAGON || tool === Tool.CYLINDER || tool === Tool.CLOUD || tool === Tool.STAR;
        if (width < MIN_SHAPE_SIZE && height < MIN_SHAPE_SIZE && tool !== Tool.ARROW) { width = DEFAULT_SHAPE_WIDTH / 1.5; height = DEFAULT_SHAPE_HEIGHT / 1.5; }
        else if (width < MIN_SHAPE_SIZE && isShapeTool) width = MIN_SHAPE_SIZE;
        else if (height < MIN_SHAPE_SIZE && isShapeTool) height = MIN_SHAPE_SIZE;
         if (isShapeTool) {
            const newShape: FlowchartShapeElement = {
                id, type: 'flowchart-shape', shapeType: tool.toLowerCase() as ShapeType, x, y, width, height, text: '',
                fillColor: useTransparentFill ? TRANSPARENT_FILL_VALUE : currentColor,
                borderColor: useTransparentFill ? currentColor : DEFAULT_SHAPE_BORDER_COLOR,
                strokeWidth: currentStrokeWidth, textColor: useTransparentFill ? currentColor : getTextColorForBackground(currentColor),
            };
            addElement(newShape);
            if (aiHookRef.current?.triggerAutomaticSummaryGeneration) aiHookRef.current.triggerAutomaticSummaryGeneration(newShape);
         } else if (tool === Tool.ARROW && (width > 5 || height > 5 || potentialSnapTarget || _internal_initialStartElementId)) {
             const newConnector: ConnectorElement = {
                id, type: 'connector', startPoint, endPoint: finalPos, color: currentColor, strokeWidth: currentStrokeWidth,
                lineStyle: currentLineStyle, startElementId: _internal_initialStartElementId, startAttachmentPointIndex: _internal_initialStartAttachmentPointIndex,
                endElementId: potentialSnapTarget ? potentialSnapTarget.elementId : undefined, endAttachmentPointIndex: potentialSnapTarget ? potentialSnapTarget.targetPointIndex : undefined,
            };
            addElement(newConnector);
         }
      }
    }
    setIsDrawingInteraction(false); setCurrentPathPointsState([]);
    setDrawingInteractionStateInternal(null); setIsMovingElementState(false);
    setActiveResizeHandleState(null); 
    resizingElementOriginalRef.current = null;
    movingElementOriginalStateRef.current = null;
    movingChildrenOriginalStatesRef.current = [];
    movingAttachedConnectorsOriginalStatesRef.current = [];
    mouseDownPointRef.current = null;
    setPotentialSnapTarget(null);
    setCurrentCursor(currentTool === Tool.SELECT ? 'default' : (currentTool === Tool.PAN ? 'grab' : 'crosshair'));
  }, [isDrawingInteraction, isPanningState, currentTool, currentPathPointsState, drawingInteractionStateInternal, addElement, currentColor, currentStrokeWidth, currentLineStyle, useTransparentFill, potentialSnapTarget, setPotentialSnapTarget, drawingConnectorState, aiHookRef, urlInputStep, elementManager, commitBatchUpdate]);

  return {
    handleMouseDown, handleMouseMove, handleMouseUp, handleMouseLeave,
    currentCursor, isDrawingInteraction, currentPathPoints: currentPathPointsState,
    drawingInteractionState: drawingInteractionStateInternal, handleDoubleClick,
    potentialSnapTarget, setAiHook, setMermaidHook,
  };
};
