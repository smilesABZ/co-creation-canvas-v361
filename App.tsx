// FILENAME: App.tsx - VERSION: v41 (Grouping Logic & Shortcuts)
import React, { useState, useRef, useEffect, useCallback } from 'react';
import html2canvas from 'html2canvas'; 
import {
  Tool,
  WhiteboardElement,
  Point,
  TextElement,
  FlowchartShapeElement, EmojiElement, ImageElement, ConnectorElement, ContentBoxElement, ShapeType, AiPersona, UrlElement, GroupElement
} from './types';
import {
  FALLBACK_CANVAS_WIDTH,
  FALLBACK_CANVAS_HEIGHT,
  DEFAULT_FONT_SIZE,
  DEFAULT_FONT_FAMILY,
  ZOOM_STEP_BUTTON,
  ZOOM_STEP_WHEEL,
  DEFAULT_COLOR,
  DEFAULT_STROKE_WIDTH,
  DEFAULT_SESSION_NAME,
  DEFAULT_AI_PERSONA,
  DEFAULT_LINE_STYLE,
} from './constants';

import Toolbar from './components/Toolbar';
import DraggableModal from './components/DraggableModal';
import AiModalContent from './components/AiDisplay';
import TextInputOverlay from './components/TextInputOverlay'; 
import MermaidInputModalContent from './components/MermaidInputModalContent';
import ContentBoxEditorModal from './components/ContentBoxEditorModal';
import AiSettingsModal from './components/AiSettingsModal';

import { useToolManager } from './src/features/toolManager/useToolManager';
import { useElementManager } from './src/features/elementManager/useElementManager';
import { useCanvasView } from './src/features/canvasView/useCanvasView';
import { useTextEditing, TextInputConfig } from './src/features/textEditing/useTextEditing'; 
import { useAi, AiHook } from './src/features/ai/useAi';
import { useFileOperations } from './src/features/fileOperations/useFileOperations';
import { useMermaid, MermaidHook } from './src/features/mermaid/useMermaid';
import { useInteractionManager } from './src/features/interactions/useInteractionManager';
import { DEFAULT_AI_CONFIG } from './src/features/ai/aiService';
import { AiConfig } from './types';

import {
  drawPath, drawTextElement, drawFlowchartShape, drawConnector,
  drawImageElement, drawEmojiElement, drawContentBoxElement, drawUrlElement,
  drawSelectionOutline, drawResizeHandlesForElement,
  getElementBoundingBox, drawConnectorHandles, drawSnapTargetHighlight,
  drawElementActionButtons,
  drawAISummaryText,
  drawGroupElement, 
} from './src/features/canvas/canvasUtils';
import { getTextColorForBackground } from './src/utils/colorUtils';


const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const mainContainerRef = useRef<HTMLDivElement>(null);


  const [canvasRenderWidth, setCanvasRenderWidth] = useState<number>(FALLBACK_CANVAS_WIDTH);
  const [canvasRenderHeight, setCanvasRenderHeight] = useState<number>(FALLBACK_CANVAS_HEIGHT);
  const [activeContentBoxEdit, setActiveContentBoxEdit] = useState<ContentBoxElement | null>(null);
  const [aiConfig, setAiConfig] = useState<AiConfig>(DEFAULT_AI_CONFIG);
  const [showAiSettings, setShowAiSettings] = useState<boolean>(false);

  const toolManager = useToolManager();
  const elementManager = useElementManager();
  const canvasView = useCanvasView();
  const textEditing = useTextEditing();

  const getCanvasContentImageBase64 = useCallback((captureFullContent = false): string | null => {
    const canvasToDraw = canvasRef.current;
    if (!canvasToDraw) return null;

    if (!captureFullContent) {
        return canvasToDraw.toDataURL('image/png').split(',')[1];
    }

    if (elementManager.elements.length === 0) {
        const tempEmptyCanvas = document.createElement('canvas');
        tempEmptyCanvas.width = canvasToDraw.width; 
        tempEmptyCanvas.height = canvasToDraw.height;
        const tempEmptyCtx = tempEmptyCanvas.getContext('2d');
        if (tempEmptyCtx) {
            tempEmptyCtx.fillStyle = getComputedStyle(canvasToDraw).backgroundColor || '#FFFFFF';
            tempEmptyCtx.fillRect(0, 0, tempEmptyCanvas.width, tempEmptyCanvas.height);
        }
        return tempEmptyCanvas.toDataURL('image/png').split(',')[1];
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const tempCtxForBbox = document.createElement('canvas').getContext('2d');
    if (!tempCtxForBbox) return null;

    elementManager.elements.forEach(el => {
        if (el.type !== 'group' && (el as any).groupId) return;

        const bbox = getElementBoundingBox(el, tempCtxForBbox);
        if (bbox) {
            minX = Math.min(minX, bbox.x);
            minY = Math.min(minY, bbox.y);
            maxX = Math.max(maxX, bbox.x + bbox.width);
            maxY = Math.max(maxY, bbox.y + bbox.height);
        }
    });

    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;

    if (contentWidth <=0 || contentHeight <= 0) { 
      return canvasToDraw.toDataURL('image/png').split(',')[1]; 
    }

    const tempRenderCanvas = document.createElement('canvas');
    tempRenderCanvas.width = contentWidth;
    tempRenderCanvas.height = contentHeight;
    const tempRenderCtx = tempRenderCanvas.getContext('2d');

    if (!tempRenderCtx) return null;

    tempRenderCtx.fillStyle = getComputedStyle(canvasToDraw).backgroundColor || '#FFFFFF';
    tempRenderCtx.fillRect(0, 0, tempRenderCanvas.width, tempRenderCanvas.height);

    elementManager.elements.forEach(element => {
      drawSingleElementOnContext(tempRenderCtx, element, minX, minY, 1, elementManager.getImageObject(element.id));
    });

    return tempRenderCanvas.toDataURL('image/png').split(',')[1];
  }, [elementManager.elements, elementManager.getImageObject]);


  const getFullAppScreenshotBase64 = useCallback(async (): Promise<string | null> => {
    if (!mainContainerRef.current) return null;
    try {
        const canvas = await html2canvas(mainContainerRef.current, {
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#ffffff',
            scale: 1,
            logging: false,
        });
        return canvas.toDataURL('image/png').split(',')[1];
    } catch (error) {
        console.error("Error capturing full app screenshot:", error);
        return null;
    }
  }, []);

  const aiHook = useAi({
    elementManager,
    toolManager,
    getCanvasImageBase64: () => getCanvasContentImageBase64(true), 
    canvasRenderWidth,
    canvasRenderHeight,
    viewBoxX: canvasView.viewBoxX,
    viewBoxY: canvasView.viewBoxY,
    aiConfig,
  });

  useEffect(() => {
    (window as any).aiHookInstance = aiHook;
    return () => { delete (window as any).aiHookInstance; };
  }, [aiHook]);


  const fileOperations = useFileOperations({
    elementManager,
    canvasView,
    aiHook,
    getCanvasImageBase64: () => getCanvasContentImageBase64(true), 
    getFullAppScreenshotBase64,
    canvasRenderWidth,
    canvasRenderHeight,
    setCurrentTool: toolManager.setCurrentTool,
    setSelectedElementId: elementManager.setSelectedElementId,
  });

  const mermaidHook = useMermaid({ elementManager, canvasView, toolManager, canvasRenderWidth, canvasRenderHeight });

  const handleEditContentBox = useCallback((element: ContentBoxElement) => {
    setActiveContentBoxEdit(element);
  }, []);

  const interactionManager = useInteractionManager({
    toolManager,
    elementManager,
    canvasView,
    textEditing,
    canvasRef,
    canvasRenderWidth,
    canvasRenderHeight,
    onEditContentBox: handleEditContentBox,
  });
  interactionManager.setAiHook(aiHook); 
  interactionManager.setMermaidHook(mermaidHook);


  const drawSingleElementOnContext = (
    ctx: CanvasRenderingContext2D,
    element: WhiteboardElement,
    viewBoxX: number,
    viewBoxY: number,
    currentZoomLevel: number,
    imageObj?: HTMLImageElement
  ) => {
    switch (element.type) {
      case 'path': drawPath(ctx, element, viewBoxX, viewBoxY, currentZoomLevel); break;
      case 'text': drawTextElement(ctx, element, viewBoxX, viewBoxY, currentZoomLevel); break;
      case 'url': drawUrlElement(ctx, element as UrlElement, viewBoxX, viewBoxY, currentZoomLevel); break;
      case 'flowchart-shape': drawFlowchartShape(ctx, element, viewBoxX, viewBoxY, currentZoomLevel); break;
      case 'connector': drawConnector(ctx, element, viewBoxX, viewBoxY, currentZoomLevel); break;
      case 'image': drawImageElement(ctx, element, imageObj, viewBoxX, viewBoxY, currentZoomLevel); break;
      case 'emoji': drawEmojiElement(ctx, element, viewBoxX, viewBoxY, currentZoomLevel); break;
      case 'content-box': drawContentBoxElement(ctx, element, viewBoxX, viewBoxY, currentZoomLevel); break;
      case 'group':
        // The group itself might have a visual representation if needed (e.g., a faint box if unselected)
        // For now, it's primarily a logical container. Selection outline is handled separately.
        // drawGroupElement(ctx, element as GroupElement, viewBoxX, viewBoxY, currentZoomLevel);
        break;
      default: console.warn('Unknown element type for drawing:', element);
    }
  };

  const drawCanvasContent = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw non-grouped elements and children of unselected groups first
    elementManager.elements.forEach(element => {
      const isChildOfSelectedGroup = (element as any).groupId && elementManager.getElementById( (element as any).groupId )?.id === elementManager.selectedElementId;
      if (!isChildOfSelectedGroup) {
         drawSingleElementOnContext(ctx, element, canvasView.viewBoxX, canvasView.viewBoxY, canvasView.zoomLevel, elementManager.getImageObject(element.id));
      }
    });
    
    // Draw selected group and its children on top (or just selected group if it handles children drawing)
    if (elementManager.selectedElementId) {
        const selectedEl = elementManager.getElementById(elementManager.selectedElementId);
        if (selectedEl && selectedEl.type === 'group') {
            // drawGroupElement(ctx, selectedEl as GroupElement, canvasView.viewBoxX, canvasView.viewBoxY, canvasView.zoomLevel); // Draw group's own visual if any
            // Then draw its children
            (selectedEl as GroupElement).childElementIds.forEach(childId => {
                const childEl = elementManager.getElementById(childId);
                if (childEl) {
                    drawSingleElementOnContext(ctx, childEl, canvasView.viewBoxX, canvasView.viewBoxY, canvasView.zoomLevel, elementManager.getImageObject(childEl.id));
                }
            });
        }
    }


    if (elementManager.selectedElementId) {
      const selectedEl = elementManager.getElementById(elementManager.selectedElementId);
      if (selectedEl) {
        drawSelectionOutline(ctx, selectedEl, canvasView.viewBoxX, canvasView.viewBoxY, canvasView.zoomLevel);
        if (selectedEl.type === 'flowchart-shape' || selectedEl.type === 'emoji' || selectedEl.type === 'image' || selectedEl.type === 'content-box' || selectedEl.type === 'group') {
          drawResizeHandlesForElement(ctx, selectedEl as any, canvasView.viewBoxX, canvasView.viewBoxY, canvasView.zoomLevel);
        }
        if (selectedEl.type === 'flowchart-shape' || selectedEl.type === 'content-box' || selectedEl.type === 'image' || selectedEl.type === 'group') {
          drawConnectorHandles(ctx, selectedEl, canvasView.viewBoxX, canvasView.viewBoxY, canvasView.zoomLevel);
        }
        if (selectedEl.type !== 'connector') {
            drawElementActionButtons(ctx, selectedEl, canvasView.viewBoxX, canvasView.viewBoxY, canvasView.zoomLevel);
            if (selectedEl.aiSummaryVisible) {
                drawAISummaryText(ctx, selectedEl, canvasView.viewBoxX, canvasView.viewBoxY, canvasView.zoomLevel);
            }
        }
      }
    } else if (elementManager.multiSelectedElementIds.length > 0) {
        elementManager.multiSelectedElementIds.forEach(id => {
            const el = elementManager.getElementById(id);
            if (el) {
                drawSelectionOutline(ctx, el, canvasView.viewBoxX, canvasView.viewBoxY, canvasView.zoomLevel);
                // No resize handles or action buttons for multi-selected elements for now
            }
        });
    }


    if (interactionManager.drawingInteractionState?.tool === Tool.PENCIL && interactionManager.currentPathPoints.length > 0) {
      drawPath(ctx, { id: 'temp-path', type: 'path', points: interactionManager.currentPathPoints, color: toolManager.currentColor, strokeWidth: toolManager.currentStrokeWidth }, canvasView.viewBoxX, canvasView.viewBoxY, canvasView.zoomLevel);
    } else if (interactionManager.drawingInteractionState && interactionManager.drawingInteractionState.tool !== Tool.ERASER && interactionManager.drawingInteractionState.tool !== Tool.PAN) {
      const { tool, startPoint, currentPoint } = interactionManager.drawingInteractionState;
      const x = Math.min(startPoint.x, currentPoint.x);
      const y = Math.min(startPoint.y, currentPoint.y);
      const width = Math.abs(startPoint.x - currentPoint.x);
      const height = Math.abs(startPoint.y - currentPoint.y);

      const tempElementId = 'temp-drawing';
      if (tool === Tool.ARROW) {
        const finalEndPoint = interactionManager.potentialSnapTarget ? interactionManager.potentialSnapTarget.targetPoint : currentPoint;
        drawConnector(ctx, { id: tempElementId, type: 'connector', startPoint, endPoint: finalEndPoint, color: toolManager.currentColor, strokeWidth: toolManager.currentStrokeWidth, lineStyle: toolManager.currentLineStyle }, canvasView.viewBoxX, canvasView.viewBoxY, canvasView.zoomLevel);
      } else if (
        tool === Tool.RECTANGLE || tool === Tool.OVAL || tool === Tool.DIAMOND ||
        tool === Tool.TRIANGLE || tool === Tool.PARALLELOGRAM || tool === Tool.HEXAGON ||
        tool === Tool.CYLINDER || tool === Tool.CLOUD || tool === Tool.STAR
      ) {
        drawFlowchartShape(ctx, {
          id: tempElementId, type: 'flowchart-shape', shapeType: tool.toLowerCase() as ShapeType, x, y, width, height, text: '',
          fillColor: toolManager.useTransparentFill ? 'transparent' : toolManager.currentColor,
          borderColor: toolManager.useTransparentFill ? toolManager.currentColor : '#000000',
          strokeWidth: toolManager.currentStrokeWidth, textColor: getTextColorForBackground(toolManager.currentColor)
        }, canvasView.viewBoxX, canvasView.viewBoxY, canvasView.zoomLevel);
      }
    }
    if (interactionManager.potentialSnapTarget) {
        drawSnapTargetHighlight(ctx, interactionManager.potentialSnapTarget.targetPoint, canvasView.viewBoxX, canvasView.viewBoxY, canvasView.zoomLevel);
    }

  }, [elementManager, toolManager, canvasView, interactionManager, drawSingleElementOnContext]);

  const handleAppDefaultTextSubmit = useCallback((text: string) => {
    try {
        if (textEditing.textInputConfig && textEditing.textInputConfig.targetId) {
            const targetId = textEditing.textInputConfig.targetId;
            const targetElement = elementManager.getElementById(targetId);

            if (targetElement) {
                let elementAfterTextUpdate: WhiteboardElement | undefined = undefined;

                if (targetElement.type === 'flowchart-shape') {
                    const updatedShape = { ...targetElement, text };
                    elementManager.updateElement(updatedShape);
                    elementAfterTextUpdate = updatedShape;
                } else if (targetElement.type === 'text') {
                    const updatedTextEl = { ...targetElement, text };
                    elementManager.updateElement(updatedTextEl);
                    elementAfterTextUpdate = updatedTextEl;
                }
                
                if (elementAfterTextUpdate && elementAfterTextUpdate.type !== 'connector' && aiHook.triggerAutomaticSummaryGeneration) {
                    aiHook.triggerAutomaticSummaryGeneration(elementAfterTextUpdate);
                }
            }
        }
    } catch (error) {
        console.error("Error during default text submission:", error);
    } finally {
        textEditing.cancelTextEditing(); 
    }
  }, [textEditing, elementManager, aiHook]);


  const handleContentBoxSave = useCallback((newContent: string) => {
    if (activeContentBoxEdit) {
      const updatedElement = { ...activeContentBoxEdit, content: newContent };
      elementManager.updateElement(updatedElement); 
       if (aiHook.triggerAutomaticSummaryGeneration) {
          aiHook.triggerAutomaticSummaryGeneration(updatedElement);
      }
      setActiveContentBoxEdit(null);
    }
  }, [activeContentBoxEdit, elementManager, aiHook]);

  const canGroup = elementManager.multiSelectedElementIds.length > 1;
  const canUngroup = () => {
    if (elementManager.selectedElementId) {
      const el = elementManager.getElementById(elementManager.selectedElementId);
      return el?.type === 'group';
    }
    return false;
  };


  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resizeObserver = new ResizeObserver(entries => {
      for (let entry of entries) {
        setCanvasRenderWidth(entry.contentRect.width);
        setCanvasRenderHeight(entry.contentRect.height);
      }
    });
    resizeObserver.observe(canvas);
    return () => resizeObserver.unobserve(canvas);
  }, []);

  useEffect(() => {
    drawCanvasContent();
  }, [elementManager.elements, elementManager.selectedElementId, elementManager.multiSelectedElementIds, toolManager, canvasView, interactionManager, drawCanvasContent, activeContentBoxEdit]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isModalOpen = !!activeContentBoxEdit || aiHook.showInteractionModal || mermaidHook.showMermaidModal || aiHook.showAnalysisModal || showAiSettings;
      const isEditingInput = textEditing.isTextModeActive || (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement);

      if (isEditingInput || isModalOpen) { 
        if (event.key === 'Escape') { 
            if (textEditing.isTextModeActive) textEditing.cancelTextEditing();
            else if (activeContentBoxEdit) setActiveContentBoxEdit(null);
            else if (mermaidHook.showMermaidModal) mermaidHook.closeMermaidModal();
            else if (aiHook.showInteractionModal) aiHook.closeInteractionModal();
            else if (aiHook.showAnalysisModal) aiHook.closeAnalysisModal();
            else if (showAiSettings) setShowAiSettings(false);
        }
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (elementManager.canUndo) elementManager.undo();
      } else if ((event.ctrlKey || event.metaKey) && (event.key.toLowerCase() === 'y' || (event.shiftKey && event.key.toLowerCase() === 'z'))) {
        event.preventDefault();
        if (elementManager.canRedo) elementManager.redo();
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'g') {
        event.preventDefault();
        if (event.shiftKey) { // Ctrl+Shift+G for Ungroup
          if (canUngroup()) elementManager.ungroupSelectedElement();
        } else { // Ctrl+G for Group
          if (canGroup) elementManager.groupSelectedElements();
        }
      } else if (event.key === 'Delete' || event.key === 'Backspace') {
        if (elementManager.selectedElementId) {
          elementManager.removeElement(elementManager.selectedElementId);
        } else if (elementManager.multiSelectedElementIds.length > 0) {
          // Future: Remove all multi-selected elements. Requires command modification or compound command.
          // For now, this might not do anything or only the last "focused" if any.
          // To be safe, let's make it clear it only works on single selection for now.
        }
      } else if (event.key === 'Escape') {
        if (elementManager.selectedElementId) elementManager.setSelectedElementId(null);
        if (elementManager.multiSelectedElementIds.length > 0) elementManager.clearMultiSelection();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [elementManager, textEditing.isTextModeActive, textEditing.cancelTextEditing, activeContentBoxEdit, mermaidHook, aiHook, canGroup, canUngroup]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const sign = Math.sign(e.deltaY);
      const currentZoom = canvasView.zoomLevel;
      const newZoomLevel = currentZoom - sign * ZOOM_STEP_WHEEL * currentZoom * 10;
      const viewportMousePos = {
        x: e.clientX - (canvas.getBoundingClientRect().left || 0),
        y: e.clientY - (canvas.getBoundingClientRect().top || 0)
      };
      canvasView.zoomAtPoint(viewportMousePos, newZoomLevel);
    };

    canvas.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      canvas.removeEventListener('wheel', handleWheel);
    };
  }, [canvasRef, canvasView.zoomAtPoint, canvasView.zoomLevel, ZOOM_STEP_WHEEL]);

  return (
    <div ref={mainContainerRef} className="flex flex-col h-screen bg-gray-200">
      <Toolbar
        currentTool={toolManager.currentTool}
        setCurrentTool={toolManager.setCurrentTool}
        currentColor={toolManager.currentColor}
        setCurrentColor={toolManager.setCurrentColor}
        currentStrokeWidth={toolManager.currentStrokeWidth}
        setCurrentStrokeWidth={toolManager.setCurrentStrokeWidth}
        useTransparentFill={toolManager.useTransparentFill}
        setUseTransparentFill={toolManager.setUseTransparentFill}
        currentLineStyle={toolManager.currentLineStyle}
        setCurrentLineStyle={toolManager.setCurrentLineStyle}
        onSetSelectedEmojiStamp={toolManager.setSelectedEmojiStamp}
        currentAiPersona={aiHook.currentAiPersona}
        onSetCurrentAiPersona={aiHook.setCurrentAiPersona}
        onClearCanvas={elementManager.clearCanvasElements}
        onOpenAiInteraction={aiHook.openInteractionModal}
        onInitiateAnalysis={aiHook.openAnalysisModal}
        onOpenAiSettings={() => setShowAiSettings(true)}
        onSaveCanvas={fileOperations.saveCanvasAsImage}
        onSaveModelCard={fileOperations.saveModelCard}
        onSaveBriefcase={fileOperations.saveBriefcaseAsZip}
        onImportImage={fileOperations.triggerImageImport}
        onOpenMermaidModal={mermaidHook.openMermaidModal}
        isAiLoading={aiHook.isAiLoading}
        isModelCardGenerating={fileOperations.isModelCardGenerating}
        isBriefcaseSaving={fileOperations.isBriefcaseSaving}
        sessionName={elementManager.sessionName}
        onSessionNameChange={elementManager.onSessionNameChange}
        onSaveSession={fileOperations.saveSession}
        isSessionSaving={fileOperations.isSessionSaving}
        currentZoomLevel={canvasView.zoomLevel}
        onZoomIn={() => canvasView.zoomAtPoint({ x: canvasRenderWidth / 2, y: canvasRenderHeight / 2 }, canvasView.zoomLevel + ZOOM_STEP_BUTTON)}
        onZoomOut={() => canvasView.zoomAtPoint({ x: canvasRenderWidth / 2, y: canvasRenderHeight / 2 }, canvasView.zoomLevel - ZOOM_STEP_BUTTON)}
        onResetZoom={canvasView.resetView}
        onUndo={elementManager.undo}
        onRedo={elementManager.redo}
        canUndo={elementManager.canUndo}
        canRedo={elementManager.canRedo}
        canGroup={canGroup}
        onGroup={elementManager.groupSelectedElements}
        canUngroup={canUngroup()}
        onUngroup={elementManager.ungroupSelectedElement}
      />
      <input type="file" ref={fileOperations.fileInputRef} onChange={fileOperations.handleFileSelected} accept={fileOperations.acceptedFileTypes} style={{ display: 'none' }} />

      <div className="flex-grow relative overflow-hidden touch-none" style={{ cursor: interactionManager.currentCursor }}>
        <canvas
          ref={canvasRef}
          width={canvasRenderWidth}
          height={canvasRenderHeight}
          className="w-full h-full bg-white"
          onMouseDown={interactionManager.handleMouseDown}
          onMouseMove={interactionManager.handleMouseMove}
          onMouseUp={interactionManager.handleMouseUp}
          onMouseLeave={interactionManager.handleMouseLeave}
          onTouchStart={interactionManager.handleMouseDown as any}
          onTouchMove={interactionManager.handleMouseMove as any}
          onTouchEnd={interactionManager.handleMouseUp as any}
          onDoubleClick={interactionManager.handleDoubleClick}
        />
        {textEditing.isTextModeActive && textEditing.textInputConfig && (
          <TextInputOverlay
            key={textEditing.textInputConfig.placeholder || 'text-input-overlay'} 
            {...textEditing.textInputConfig}
            onSubmit={textEditing.activeSubmit || handleAppDefaultTextSubmit}
            onCancel={textEditing.activeCancel || textEditing.cancelTextEditing}
          />
        )}
      </div>

      <DraggableModal isOpen={aiHook.showInteractionModal} onClose={aiHook.closeInteractionModal} title="Interact with AI" width="600px" height="auto" maxHeight="70vh">
        <AiModalContent
          isLoading={aiHook.isAiLoading}
          error={aiHook.interactionResult?.error || null}
          responseText={aiHook.interactionResult?.analysisText || null}
          showPromptInput={true}
          userPrompt={aiHook.interactionUserPrompt}
          onUserPromptChange={aiHook.setInteractionUserPrompt}
          onSendPrompt={aiHook.sendInteractionPrompt}
          groundingMetadata={aiHook.interactionResult?.groundingMetadata}
          actionWords={aiHook.actionWords}
          onActionWordSelect={aiHook.handleActionWordSelect}
        />
      </DraggableModal>

      <DraggableModal isOpen={aiHook.showAnalysisModal} onClose={aiHook.closeAnalysisModal} title="AI Analysis" width="550px" height="auto" maxHeight="65vh">
        <AiModalContent
          isLoading={aiHook.isAiLoading}
          error={aiHook.analysisResult?.error || null}
          responseText={aiHook.analysisResult?.analysisText || null}
          showPromptInput={false}
          groundingMetadata={aiHook.analysisResult?.groundingMetadata}
        />
      </DraggableModal>

      <DraggableModal isOpen={mermaidHook.showMermaidModal} onClose={mermaidHook.closeMermaidModal} title="Create/Edit Mermaid Diagram" width="700px" height="auto" maxHeight="80vh">
        <MermaidInputModalContent
          mermaidSyntax={mermaidHook.mermaidSyntax}
          onMermaidSyntaxChange={mermaidHook.setMermaidSyntax}
          onRender={mermaidHook.renderMermaidToCanvas}
          isLoading={mermaidHook.isMermaidRendering}
          error={mermaidHook.mermaidError}
        />
      </DraggableModal>

      <DraggableModal
        isOpen={!!activeContentBoxEdit}
        onClose={() => setActiveContentBoxEdit(null)}
        title={activeContentBoxEdit?.filename ? `Edit: ${activeContentBoxEdit.filename}` : "Edit Content Box"}
        width="700px"
        height="auto"
        maxHeight="80vh"
      >
        {activeContentBoxEdit && (
          <ContentBoxEditorModal
            isOpen={!!activeContentBoxEdit}
            onClose={() => setActiveContentBoxEdit(null)}
            onSave={handleContentBoxSave}
            initialContent={activeContentBoxEdit.content}
            contentType={activeContentBoxEdit.contentType}
            filename={activeContentBoxEdit.filename}
          />
        )}
      </DraggableModal>

      <AiSettingsModal
        isOpen={showAiSettings}
        onClose={() => setShowAiSettings(false)}
        config={aiConfig}
        onSave={(newConfig) => {
          setAiConfig(newConfig);
          setShowAiSettings(false);
        }}
      />

    </div>
  );
};

export default App;
