// FILENAME: src/features/ai/useAi.ts - VERSION: v15 (Refactored to AI-generic)
// Updated to v10: Added action words dropdown functionality for interaction modal
// Updated to v11: Fallback for Mermaid image summary failures.
// Updated to v12: Modified triggerAutomaticSummaryGeneration to prevent content reversion by consistently using the passed-in element data.
// Updated to v13: Ensure AI summary updates use elementManager.setElements directly to bypass Command history.
// Updated to v14: Add handling for AiUrlCommand.
import React, { useState, useCallback } from 'react';
import { GenerateContentResponse, GenerateContentParameters, Part } from "@google/genai";
import {
    AiResponse, AiPersona, AiDrawingCommand,
    PathElement, ContentBoxElement, FlowchartShapeElement, ConnectorElement, ImageElement, EmojiElement, UrlElement,
    AiFlowchartShapeCommand, AiConnectorCommand, AiModifyElementCommand, AiUrlCommand,
    TargetElementDescription, WhiteboardElement, ShapeType, AiTextCommand as ParsedAiTextCommand,
    GroundingChunk, WebChunk, AiConfig
} from '../../../types';
import { interactWithAI, GEMINI_MODEL_TEXT_ONLY, GEMINI_MULTIMODAL_MODEL, interactWithAiTextOnly } from './aiService';
import { ElementManagerHook } from '../elementManager/useElementManager';
import { ToolManagerHook } from '../toolManager/useToolManager';
import {
    DEFAULT_AI_PERSONA, TRANSPARENT_FILL_VALUE, DEFAULT_SHAPE_BORDER_COLOR, DEFAULT_COLOR,
    MIN_SHAPE_SIZE, MIN_IMAGE_SIZE, MIN_EMOJI_SIZE, DEFAULT_FONT_SIZE, DEFAULT_FONT_FAMILY,
    DEFAULT_ONSCREEN_TEXT_BOX_WIDTH, DEFAULT_ONSCREEN_TEXT_BOX_HEIGHT, DEFAULT_CONTENT_BOX_FONT_SIZE,
    DEFAULT_CONTENT_BOX_BACKGROUND_COLOR, DEFAULT_CONTENT_BOX_TEXT_COLOR
} from '../../../constants';
import { getTextColorForBackground } from '../../utils/colorUtils';


// Helper to format date-time for filenames
const getFormattedDateTimeForFilename = () => {
  const now = new Date();
  const YYYY = now.getFullYear();
  const MM = String(now.getMonth() + 1).padStart(2, '0');
  const DD = String(now.getDate()).padStart(2, '0');
  const HH = String(now.getHours()).padStart(2, '0');
  const MIN = String(now.getMinutes()).padStart(2, '0');
  const SS = String(now.getSeconds()).padStart(2, '0');
  return `${YYYY}${MM}${DD}_${HH}${MIN}${SS}`;
};

interface UseAiProps {
  elementManager: ElementManagerHook;
  toolManager: ToolManagerHook;
  getCanvasImageBase64: () => string | null;
  canvasRenderWidth: number;
  canvasRenderHeight: number;
  viewBoxX: number;
  viewBoxY: number;
  aiConfig: AiConfig;
}

export interface AiHook {
  isAiLoading: boolean;
  currentAiPersona: AiPersona;
  setCurrentAiPersona: React.Dispatch<React.SetStateAction<AiPersona>>;

  showAnalysisModal: boolean;
  analysisResult: AiResponse | null;
  openAnalysisModal: () => Promise<void>;
  closeAnalysisModal: () => void;

  showInteractionModal: boolean;
  interactionUserPrompt: string;
  setInteractionUserPrompt: React.Dispatch<React.SetStateAction<string>>;
  interactionResult: AiResponse | null;
  openInteractionModal: () => void;
  sendInteractionPrompt: () => Promise<void>;
  closeInteractionModal: () => void;

  generateSummaryForElement: (element: WhiteboardElement) => Promise<string | null>;
  triggerAutomaticSummaryGeneration: (element: WhiteboardElement) => Promise<void>;

  // For action words dropdown
  actionWords: string[];
  handleActionWordSelect: (actionWord: string) => void;
}

const ACTION_WORDS: string[] = ['Describe', 'Explain', 'Summarize', 'Synthesize', 'Analyze', 'List', 'Compare', 'Contrast', 'Define', 'Suggest', 'Generate', 'Create'];

type UpdatableAISummaryElement = Exclude<WhiteboardElement, ConnectorElement>;


export const useAi = ({
  elementManager,
  toolManager,
  getCanvasImageBase64,
  canvasRenderWidth,
  canvasRenderHeight,
  viewBoxX,
  viewBoxY,
  aiConfig,
}: UseAiProps): AiHook => {
  const { elements, addElement, updateElement, selectedElementId, setSelectedElementId, setElements } = elementManager; // `updateElement` here is the command-creating one. `setElements` is the direct setter.
  const { currentStrokeWidth, currentColor } = toolManager;

  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  const [currentAiPersona, setCurrentAiPersona] = useState<AiPersona>(DEFAULT_AI_PERSONA);

  const [showAnalysisModal, setShowAnalysisModal] = useState<boolean>(false);
  const [analysisResult, setAnalysisResult] = useState<AiResponse | null>(null);

  const [showInteractionModal, setShowInteractionModal] = useState<boolean>(false);
  const [interactionUserPrompt, setInteractionUserPrompt] = useState<string>('');
  const [interactionResult, setInteractionResult] = useState<AiResponse | null>(null);


  const createAndAddAiResponseContentBox = useCallback((
    result: AiResponse,
    promptText: string | undefined,
    currentViewBoxX: number,
    currentViewBoxY: number
  ) => {
    if (!result.analysisText && (!result.groundingMetadata || !result.groundingMetadata.groundingChunks || result.groundingMetadata.groundingChunks.length === 0)) {
      return; // No content to put in a box
    }

    let markdownContent = "";

    if (promptText) {
      markdownContent += `## User Prompt\n${promptText}\n\n`;
    }
    if (result.analysisText) {
      markdownContent += `## AI's Response\n${result.analysisText}\n\n`;
    }
    if (result.groundingMetadata && result.groundingMetadata.groundingChunks && result.groundingMetadata.groundingChunks.length > 0) {
      markdownContent += `## Sources\n`;
      result.groundingMetadata.groundingChunks.forEach(chunk => {
        const sourceInfo: WebChunk | undefined = chunk.web || chunk.searchResult;
        if (sourceInfo && sourceInfo.uri) {
          markdownContent += `* [${sourceInfo.title || sourceInfo.uri}](${sourceInfo.uri})\n`;
        }
      });
    }

    if (!markdownContent.trim()) return;

    const newContentBoxId = `ai-response-cb-${Date.now()}`;
    const newContentBox: ContentBoxElement = {
      id: newContentBoxId,
      type: 'content-box',
      x: currentViewBoxX + 50,
      y: currentViewBoxY + 50,
      width: 500,
      height: 300,
      contentType: 'markdown',
      filename: `AI_Response_${getFormattedDateTimeForFilename()}.md`,
      content: markdownContent.trim(),
      backgroundColor: DEFAULT_CONTENT_BOX_BACKGROUND_COLOR,
      textColor: DEFAULT_CONTENT_BOX_TEXT_COLOR,
      fontSize: DEFAULT_CONTENT_BOX_FONT_SIZE,
    };
    // Use elementManager's addElement which creates a command
    elementManager.addElement(newContentBox);
  }, [elementManager, viewBoxX, viewBoxY]); // Use elementManager.addElement for history


  const openAnalysisModal = useCallback(async () => {
    const imageBase64 = getCanvasImageBase64();
    if (!imageBase64) {
      setAnalysisResult({ error: "Failed to capture whiteboard image for analysis." });
      setShowAnalysisModal(true);
      return;
    }
    setIsAiLoading(true);
    setAnalysisResult(null);
    setShowAnalysisModal(true);
    const analysisPrompt = `Provide a concise summary of the current activities, key topics, or ideas presented on this whiteboard. Describe any significant text, diagrams, or drawings. Do not ask clarifying questions, just provide the analysis based on the image. The current canvas size is ${canvasRenderWidth}x${canvasRenderHeight} pixels.`;
    try {
      const result = await interactWithAI(imageBase64, analysisPrompt, canvasRenderWidth, canvasRenderHeight, 'helpful-assistant', aiConfig);
      setAnalysisResult(result);
      // createAndAddAiResponseContentBox will use elementManager.addElement
      createAndAddAiResponseContentBox(result, undefined, viewBoxX, viewBoxY);
    } catch (err: any) {
      setAnalysisResult({ error: err.message || "An unknown error occurred during analysis." });
    } finally {
      setIsAiLoading(false);
    }
  }, [getCanvasImageBase64, canvasRenderWidth, canvasRenderHeight, createAndAddAiResponseContentBox, viewBoxX, viewBoxY, aiConfig]);

  const closeAnalysisModal = useCallback(() => setShowAnalysisModal(false), []);

  const openInteractionModal = useCallback(() => {
    setShowInteractionModal(true);
    setInteractionResult(null);
  }, []);

  const closeInteractionModal = useCallback(() => setShowInteractionModal(false), []);

  const handleActionWordSelect = useCallback((actionWord: string) => {
    setInteractionUserPrompt(prevPrompt => {
        if (prevPrompt.trim() === "") {
            return `${actionWord} `;
        }
        return `${actionWord} ${prevPrompt}`;
    });
  }, []);

  const findTargetElement = (description: TargetElementDescription, currentElementsToSearch: WhiteboardElement[]): WhiteboardElement | null => {
    if (description.id) return currentElementsToSearch.find(el => el.id === description.id) || null;
    let bestMatch: WhiteboardElement | null = null;
    let highestScore = 0;
    currentElementsToSearch.forEach(el => {
        let currentScore = 0;
        if (el.type === 'flowchart-shape') {
            if (description.shapeType && el.shapeType === description.shapeType) currentScore += 10;
            if (description.textContains && el.text && el.text.toLowerCase().includes(description.textContains.toLowerCase())) currentScore += (el.text.toLowerCase() === description.textContains.toLowerCase()) ? 8 : 5;
            if (description.color && el.fillColor.toLowerCase() === description.color.toLowerCase()) currentScore += 3;
        } else if (el.type === 'text') {
            if (description.textContains && el.text && el.text.toLowerCase().includes(description.textContains.toLowerCase())) currentScore += (el.text.toLowerCase() === description.textContains.toLowerCase()) ? 8 : 5;
            if (description.color && el.color.toLowerCase() === description.color.toLowerCase()) currentScore += 3;
        } else if (el.type === 'content-box') {
             if (description.textContains && el.content && el.content.toLowerCase().includes(description.textContains.toLowerCase())) currentScore += (el.content.toLowerCase() === description.textContains.toLowerCase()) ? 8 : 5;
             if (description.color && el.backgroundColor.toLowerCase() === description.color.toLowerCase()) currentScore += 3;
        }
        // Add matching for UrlElement if needed by Gemini targeting. For now, it's not targeted.
        if (currentScore > highestScore) { highestScore = currentScore; bestMatch = el; }
    });
    return bestMatch;
  };

  const sendInteractionPrompt = useCallback(async () => {
    const imageBase64 = getCanvasImageBase64();
    if (!imageBase64) {
      setInteractionResult({ error: "Failed to capture whiteboard image for interaction." });
      return;
    }
    setIsAiLoading(true);
    let newSelectedElementIdFromAi = elementManager.selectedElementId;

    try {
      const result = await interactWithAI(imageBase64, interactionUserPrompt, canvasRenderWidth, canvasRenderHeight, currentAiPersona, aiConfig);

      setInteractionResult(result);
      // This will use elementManager.addElement internally, creating commands
      createAndAddAiResponseContentBox(result, interactionUserPrompt, viewBoxX, viewBoxY);

      if (result.drawings && result.drawings.length > 0) {
        // After potential content box creation, get the latest elements state from elementManager
        // This is tricky because addElement is async regarding state updates for the hook.
        // For simplicity, we assume commands are processed, and then elementManager.elements would be updated.
        // However, to be safe, findTargetElement should use the elements state *before* these new drawings are applied,
        // or a snapshot taken before the loop.
        const elementsAtStartOfDrawingLoop = [...elementManager.elements];

        result.drawings.forEach((cmd: AiDrawingCommand, index) => {
          const commonId = `ai-draw-${Date.now()}-${index}`;
          if (cmd.type === 'path') {
            const newPath: PathElement = { id: commonId, type: 'path', points: cmd.points, color: cmd.color, strokeWidth: cmd.strokeWidth };
            elementManager.addElement(newPath); // Creates AddElementCommand
          } else if (cmd.type === 'text') {
            const textCmd = cmd as ParsedAiTextCommand;
            const newContentBox: ContentBoxElement = {
              id: commonId, type: 'content-box', x: textCmd.x, y: textCmd.y,
              width: textCmd.width || DEFAULT_ONSCREEN_TEXT_BOX_WIDTH, height: textCmd.height || DEFAULT_ONSCREEN_TEXT_BOX_HEIGHT,
              contentType: 'plaintext', filename: undefined, content: textCmd.content,
              backgroundColor: textCmd.backgroundColor || TRANSPARENT_FILL_VALUE, textColor: textCmd.textColor,
              fontSize: textCmd.fontSize || DEFAULT_CONTENT_BOX_FONT_SIZE,
            };
            elementManager.addElement(newContentBox); // Creates AddElementCommand
          } else if (cmd.type === 'url') {
            const urlCmd = cmd as AiUrlCommand;
            const newUrlElement: UrlElement = {
              id: commonId, type: 'url', x: urlCmd.x, y: urlCmd.y,
              urlText: urlCmd.urlText, displayText: urlCmd.displayText,
              color: urlCmd.textColor || currentColor, // Use current toolbar color if not specified
              fontSize: urlCmd.fontSize || DEFAULT_FONT_SIZE,
              fontFamily: DEFAULT_FONT_FAMILY,
            };
            elementManager.addElement(newUrlElement);
          } else if (cmd.type === 'flowchart-shape') {
            const shapeCmd = cmd as AiFlowchartShapeCommand;
            const fillColor = shapeCmd.fillColor === 'transparent' ? TRANSPARENT_FILL_VALUE : shapeCmd.fillColor;
            const newShape: FlowchartShapeElement = {
              id: commonId, type: 'flowchart-shape', shapeType: shapeCmd.shapeType,
              x: shapeCmd.x, y: shapeCmd.y, width: shapeCmd.width, height: shapeCmd.height,
              text: shapeCmd.text || '', fillColor: fillColor,
              borderColor: shapeCmd.borderColor || (fillColor === TRANSPARENT_FILL_VALUE ? '#000000' : DEFAULT_SHAPE_BORDER_COLOR),
              strokeWidth: shapeCmd.strokeWidth || currentStrokeWidth,
              textColor: getTextColorForBackground(fillColor)
            };
            elementManager.addElement(newShape); // Creates AddElementCommand
          } else if (cmd.type === 'connector') {
            const connectorCmd = cmd as AiConnectorCommand;
            const newConnector: ConnectorElement = {
              id: commonId, type: 'connector',
              startPoint: { x: connectorCmd.startX, y: connectorCmd.startY },
              endPoint: { x: connectorCmd.endX, y: connectorCmd.endY },
              color: connectorCmd.color, strokeWidth: connectorCmd.strokeWidth || currentStrokeWidth,
              lineStyle: connectorCmd.lineStyle
            };
            elementManager.addElement(newConnector); // Creates AddElementCommand
          } else if (cmd.type === 'modify-element') {
            const modifyCmd = cmd as AiModifyElementCommand;
            // Use elementsAtStartOfDrawingLoop for finding the target, as new elements might have been added by previous commands in this loop.
            const targetElement = findTargetElement(modifyCmd.target, elementsAtStartOfDrawingLoop);
            if (targetElement) {
              let modifiedElement = { ...targetElement };
              const { modifications } = modifyCmd;
              if (typeof modifications.select === 'boolean') {
                if (modifications.select) newSelectedElementIdFromAi = targetElement.id;
                else if (newSelectedElementIdFromAi === targetElement.id) newSelectedElementIdFromAi = null;
              }
              const deltaX = modifications.deltaX || 0; const deltaY = modifications.deltaY || 0;

              if (modifiedElement.type === 'flowchart-shape' || modifiedElement.type === 'text' || modifiedElement.type === 'image' || modifiedElement.type === 'emoji' || modifiedElement.type === 'content-box' || modifiedElement.type === 'url') {
                modifiedElement.x = modifications.newX !== undefined ? modifications.newX : modifiedElement.x + deltaX;
                modifiedElement.y = modifications.newY !== undefined ? modifications.newY : modifiedElement.y + deltaY;
                if ((modifiedElement.type === 'flowchart-shape' || modifiedElement.type === 'image' || modifiedElement.type === 'content-box')) {
                  if (modifications.newWidth !== undefined) modifiedElement.width = Math.max(modifiedElement.type === 'flowchart-shape' ? MIN_SHAPE_SIZE : (modifiedElement.type === 'image' ? MIN_IMAGE_SIZE : 50), modifications.newWidth);
                  if (modifications.newHeight !== undefined) modifiedElement.height = Math.max(modifiedElement.type === 'flowchart-shape' ? MIN_SHAPE_SIZE : (modifiedElement.type === 'image' ? MIN_IMAGE_SIZE : 50), modifications.newHeight);
                } else if (modifiedElement.type === 'emoji' && modifications.newWidth !== undefined) {
                     modifiedElement.size = Math.max(MIN_EMOJI_SIZE, modifications.newWidth);
                }
              } else if (modifiedElement.type === 'path') {
                modifiedElement.points = modifiedElement.points.map(p => ({ x: p.x + deltaX, y: p.y + deltaY }));
              } else if (modifiedElement.type === 'connector') {
                modifiedElement.startPoint = { x: modifiedElement.startPoint.x + deltaX, y: modifiedElement.startPoint.y + deltaY };
                modifiedElement.endPoint = { x: modifiedElement.endPoint.x + deltaX, y: modifiedElement.endPoint.y + deltaY };
              }
              elementManager.updateElement(modifiedElement as WhiteboardElement); // Creates UpdateCommand
            } else {
                console.warn("AI: Target element not found for modification:", modifyCmd.target);
                 if(interactionResult && interactionResult.analysisText) {
                    setInteractionResult(prev => ({...prev, analysisText: (prev?.analysisText || "") + "\nNote: I couldn't find the element you wanted to modify."}));
                } else {
                    setInteractionResult(prev => ({...prev, analysisText: "Note: I couldn't find the element you wanted to modify."}));
                }
            }
          }
        });

        if (newSelectedElementIdFromAi !== elementManager.selectedElementId && (!newSelectedElementIdFromAi || !newSelectedElementIdFromAi.startsWith('ai-response-cb-'))) {
             elementManager.setSelectedElementId(newSelectedElementIdFromAi);
        }
      }
    } catch (err: any) {
      const errorMessage = err.error || err.message || "An unknown error occurred while interacting with AI.";
      console.error("[AI Interaction] Catch block error:", errorMessage, err);
      setInteractionResult({ error: errorMessage });
    } finally {
      setIsAiLoading(false);
    }
  }, [getCanvasImageBase64, interactionUserPrompt, canvasRenderWidth, canvasRenderHeight, currentAiPersona, elementManager, currentStrokeWidth, currentColor, createAndAddAiResponseContentBox, viewBoxX, viewBoxY, aiConfig]);

  const generateSummaryForElement = useCallback(async (element: WhiteboardElement): Promise<string | null> => {
    if (element.type === 'connector') {
        return Promise.resolve("This is a connector line.");
    }
    if (element.id.startsWith('ai-response-cb-')) {
        return Promise.resolve("This content box contains a response from the AI.");
    }

    const summaryPromptDepth = " (1-2 sentences)";

    const generateTextSummary = async (promptContent: string): Promise<string | null> => {
        try {
            const systemInstruction = `You are an AI assistant specializing in creating concise summaries${summaryPromptDepth} for visual elements on a digital whiteboard. Focus on the essence of the element's appearance, content, or likely purpose. Do not use conversational filler or markdown formatting. Respond only with the summary text.`;
            const response = await interactWithAiTextOnly(promptContent, systemInstruction, aiConfig);
            if (typeof response === 'object' && 'error' in response) {
                throw new Error(response.error);
            }
            if (response && response.trim() !== "") {
                let summaryText = response.trim();
                if ((summaryText.startsWith('"') && summaryText.endsWith('"')) || (summaryText.startsWith("'") && summaryText.endsWith("'"))) {
                    summaryText = summaryText.substring(1, summaryText.length - 1);
                }
                return summaryText;
            }
            return "Summary not available (empty response).";
        } catch (error: any) {
            console.error("Error generating text-based summary for element:", element.id, error);
            return `Error: ${error.message || "Could not generate text-based summary."}`;
        }
    };

    if (element.type === 'image') {
        const imageObject = elementManager.getImageObject(element.id);
        if (imageObject && imageObject.complete && imageObject.naturalWidth > 0) {
            try {
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = element.width;
                tempCanvas.height = element.height;
                const tempCtx = tempCanvas.getContext('2d');
                if (!tempCtx) throw new Error("Failed to get temporary canvas context for image summary.");

                tempCtx.drawImage(imageObject, 0, 0, element.width, element.height);
                const imageDataUrl = tempCanvas.toDataURL('image/png');
                const base64ImageData = imageDataUrl.split(',')[1];

                if (!base64ImageData) throw new Error("Failed to get base64 data from temporary canvas.");

                const textPartPrompt = `Describe the visual content of this image clearly and concisely${summaryPromptDepth}.`;
                const systemInstruction = "You are an AI assistant skilled at describing images. Provide a concise summary of the visual content. Focus on main subjects and objects. Avoid speculation. The summary should be suitable for a quick tooltip on a whiteboard.";

                // For multimodal, we still use interactWithAI but with a specific prompt
                const response = await interactWithAI(base64ImageData, textPartPrompt, element.width, element.height, 'helpful-assistant', aiConfig);
                
                if (response.error) {
                    throw new Error(response.error);
                }
                if (response.analysisText && response.analysisText.trim() !== "") {
                    let summaryText = response.analysisText.trim();
                     if ((summaryText.startsWith('"') && summaryText.endsWith('"')) || (summaryText.startsWith("'") && summaryText.endsWith("'"))) {
                        summaryText = summaryText.substring(1, summaryText.length - 1);
                    }
                    return summaryText;
                }
                throw new Error("AI returned an empty visual summary.");
            } catch (error: any) {
                console.error("Error generating visual summary for image element:", element.id, error.message);
                if (element.mermaidSyntax) {
                    console.warn("Visual summary failed for Mermaid image. Falling back to text-based summary of syntax for:", element.id);
                    const mermaidPrompt = `This is a diagram defined by Mermaid syntax. Provide a concise summary${summaryPromptDepth} of what this diagram likely represents.
--- Mermaid Syntax ---
${element.mermaidSyntax.substring(0, 1000)}
--- End Mermaid Syntax ---
Respond with only the summary text.`;
                    return generateTextSummary(mermaidPrompt);
                }
                return `Error: ${error.message || "Visual summary failed."}`;
            }
        } else {
            console.warn("Image object not ready or invalid for visual summary, falling back to text description for:", element.id);
            // Fall through to the generic text summary part
        }
    }

    let elementDetails = `Element Type: ${element.type}`;
    if (element.type === 'path') {
      elementDetails += `, Color: ${element.color}, Stroke Width: ${element.strokeWidth}, Number of Points: ${element.points.length}`;
    } else if (element.type === 'text') { // Old TextElement
      elementDetails += `, Text: "${element.text.substring(0, 50)}${element.text.length > 50 ? '...' : ''}", Color: ${element.color}, Font: ${element.font}`;
    } else if (element.type === 'url') {
        elementDetails += `, URL: ${element.urlText}, Display Text: "${element.displayText || element.urlText}"`;
    } else if (element.type === 'flowchart-shape') {
      elementDetails += `, Shape: ${element.shapeType}, Text: "${element.text.substring(0, 50)}${element.text.length > 50 ? '...' : ''}", Fill: ${element.fillColor}`;
    } else if (element.type === 'emoji') {
      elementDetails += `, Emoji: ${element.emojiChar}, Size: ${element.size}`;
    } else if (element.type === 'content-box') {
      elementDetails += `, Content Type: ${element.contentType}, Filename: ${element.filename || 'N/A'}, Content Preview: "${element.content.substring(0, 50)}${element.content.length > 50 ? '...' : ''}"`;
    }
    // If element.type === 'image' and it fell through (e.g. imageObject not ready), 
    // elementDetails will just be "Element Type: image". We can add more specific info if needed.
    else if (element.type === 'image') {
        elementDetails += element.mermaidSyntax ? `, (Mermaid Diagram)` : `, (Raster Image)`;
    }


    const promptContent = `Summarize this whiteboard element${summaryPromptDepth}: ${elementDetails}`;
    return generateTextSummary(promptContent);
  }, [elementManager, aiConfig]);

  const activeSummaryGenerations = React.useRef<number>(0);
  const MAX_CONCURRENT_SUMMARIES = 2;
  const summaryDebounceTimeouts = React.useRef<Record<string, NodeJS.Timeout>>({});

  const triggerAutomaticSummaryGeneration = useCallback(async (element: WhiteboardElement) => {
    if (element.type === 'connector') return; // No summaries for connectors
    if (element.id.startsWith('ai-response-cb-')) return; // No summaries for AI's own response boxes

    // Clear existing timeout for this element
    if (summaryDebounceTimeouts.current[element.id]) {
        clearTimeout(summaryDebounceTimeouts.current[element.id]);
    }

    // Set a new timeout
    return new Promise<void>((resolve) => {
        summaryDebounceTimeouts.current[element.id] = setTimeout(async () => {
            delete summaryDebounceTimeouts.current[element.id];

            // Wait if too many summaries are being generated
            while (activeSummaryGenerations.current >= MAX_CONCURRENT_SUMMARIES) {
                await new Promise(r => setTimeout(r, 1000));
            }

            activeSummaryGenerations.current++;
            const updatableElement = element as UpdatableAISummaryElement;

            // Use setElements directly to update loading state without creating a Command
            setElements(prevElements =>
              prevElements.map(el =>
                el.id === updatableElement.id ? { ...el, aiSummaryLoading: true, aiSummaryVisible: false } : el
              )
            );

            try {
              const summary = await generateSummaryForElement(updatableElement);
              // Use setElements directly to update summary result without creating a Command
              setElements(prevElements =>
                prevElements.map(el =>
                  el.id === updatableElement.id
                    ? { ...el, aiSummary: summary || "Summary unavailable.", aiSummaryLoading: false, aiSummaryVisible: true }
                    : el
                )
              );
            } catch (e: any) {
              // Use setElements directly to update error state without creating a Command
              setElements(prevElements =>
                prevElements.map(el =>
                  el.id === updatableElement.id
                    ? { ...el, aiSummary: `Error: ${e.message || "Could not generate summary."}`, aiSummaryLoading: false, aiSummaryVisible: true }
                    : el
                )
              );
            } finally {
              activeSummaryGenerations.current--;
              resolve();
            }
        }, 1500); // 1.5 second debounce
    });
  }, [generateSummaryForElement, setElements]);


  return {
    isAiLoading,
    currentAiPersona,
    setCurrentAiPersona,

    showAnalysisModal,
    analysisResult,
    openAnalysisModal,
    closeAnalysisModal,

    showInteractionModal,
    interactionUserPrompt,
    setInteractionUserPrompt,
    interactionResult,
    openInteractionModal,
    sendInteractionPrompt,
    closeInteractionModal,

    generateSummaryForElement,
    triggerAutomaticSummaryGeneration,

    actionWords: ACTION_WORDS,
    handleActionWordSelect,
  };
};
