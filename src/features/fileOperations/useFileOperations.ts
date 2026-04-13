
// FILENAME: src/features/fileOperations/useFileOperations.ts - VERSION: v20 (Zoom in Session)
// Updated to v17 to include Gemini response content boxes as 'prompt_cards' in the Model Card ZIP.
// Updated to v18 to add saveSession functionality and isSessionSaving state.
// Updated to v19 to fix .ccc session file loading and update file extension checks.
// Updated to v20 to include zoomLevel in session saving/loading.

import React, { useState, useRef, useCallback } from 'react';
import { WhiteboardElement, ImageElement, AiResponse, ContentBoxElement, ContentType, Tool, AiPersona, ZoomState } from '../../../types';
import { ElementManagerHook } from '../elementManager/useElementManager';
import { CanvasViewHook } from '../canvasView/useCanvasView';
import { interactWithAI } from '../ai/aiService'; 
import { AiHook } from '../ai/useAi'; 
import { DEFAULT_SESSION_NAME, SUPPORTED_TEXT_IMPORT_EXTENSIONS, ALL_SUPPORTED_IMPORT_EXTENSIONS, DEFAULT_CONTENT_BOX_WIDTH, DEFAULT_CONTENT_BOX_HEIGHT, DEFAULT_CONTENT_BOX_BACKGROUND_COLOR, DEFAULT_CONTENT_BOX_TEXT_COLOR, DEFAULT_CONTENT_BOX_FONT_SIZE, SESSION_FILE_EXTENSION, DEFAULT_ZOOM_LEVEL } from '../../../constants';

declare var JSZip: any; 

interface UseFileOperationsProps {
  elementManager: ElementManagerHook;
  canvasView: CanvasViewHook;
  aiHook: AiHook; 
  getCanvasImageBase64: () => string | null;
  getFullAppScreenshotBase64?: () => Promise<string | null>;
  canvasRenderWidth: number;
  canvasRenderHeight: number;
  setCurrentTool: (tool: Tool) => void;
  setSelectedElementId: (id: string | null) => void;
}

export interface FileOperationsHook {
  saveCanvasAsImage: () => void;
  saveModelCard: () => Promise<void>;
  saveBriefcaseAsZip: () => Promise<void>;
  triggerImageImport: () => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  handleFileSelected: (event: React.ChangeEvent<HTMLInputElement>) => void;
  acceptedFileTypes: string;
  isModelCardGenerating: boolean;
  isBriefcaseSaving: boolean;
  saveSession: () => Promise<void>; 
  isSessionSaving: boolean; 
}
const generateSafeFilename = (name: string, extension: string): string => {
  const date = new Date();
  const timestamp = `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}_${date.getHours().toString().padStart(2, '0')}${date.getMinutes().toString().padStart(2, '0')}${date.getSeconds().toString().padStart(2, '0')}`;
  const safeName = name.replace(/[^a-zA-Z0-9_-\s]/g, '').replace(/\s+/g, '_');
  return `${safeName}_${timestamp}.${extension.startsWith('.') ? extension.substring(1) : extension}`;
};


export const useFileOperations = ({
  elementManager,
  canvasView,
  aiHook, 
  getCanvasImageBase64,
  getFullAppScreenshotBase64,
  canvasRenderWidth,
  canvasRenderHeight,
  setCurrentTool,
  setSelectedElementId,
}: UseFileOperationsProps): FileOperationsHook => {
  const { elements, addElement, sessionName, setElements, onSessionNameChange, clearCanvasElements } = elementManager; 
  const { viewBoxX, viewBoxY, zoomLevel, setViewBox, setZoomLevel } = canvasView; 
  const [isModelCardGenerating, setIsModelCardGenerating] = useState(false);
  const [isBriefcaseSaving, setIsBriefcaseSaving] = useState(false);
  const [isSessionSaving, setIsSessionSaving] = useState(false); 


  const fileInputRef = useRef<HTMLInputElement>(null);
  const acceptedFileTypes = ALL_SUPPORTED_IMPORT_EXTENSIONS;


  const saveCanvasAsImage = useCallback(() => {
    const imageBase64 = getCanvasImageBase64();
    if (imageBase64) {
      const link = document.createElement('a');
      link.download = generateSafeFilename(sessionName || DEFAULT_SESSION_NAME, 'png');
      link.href = `data:image/png;base64,${imageBase64}`;
      link.click();
    } else {
      alert("Could not save canvas image. Canvas might be empty or an error occurred.");
    }
  }, [getCanvasImageBase64, sessionName]);

  const addModelCardToZip = useCallback(async (zip: any) => {
    const imageBase64 = getCanvasImageBase64();
    const fullAppScreenshotBase64 = getFullAppScreenshotBase64 ? await getFullAppScreenshotBase64() : null;

    if (!imageBase64) {
      console.warn("Could not generate model card for ZIP. Canvas image is unavailable.");
      return;
    }

    let analysisText = "AI analysis not performed for this model card.";
    try {
      const analysisPrompt = `Generate a concise model card summary for a digital whiteboard session. Based on the provided image, describe the key visual elements, potential topics, and overall nature of the content. The canvas size is ${canvasRenderWidth}x${canvasRenderHeight} pixels.`;
      const aiResult = await interactWithAI(imageBase64, analysisPrompt, canvasRenderWidth, canvasRenderHeight, 'helpful-assistant');
      if (aiResult.analysisText) {
        analysisText = aiResult.analysisText;
      } else if (aiResult.error) {
        analysisText = `Error during AI analysis: ${aiResult.error}`;
      }
    } catch (error: any) {
      analysisText = `Error performing AI analysis: ${error.message}`;
    }

    const modelCardFolder = zip.folder("model_card");
    if (!modelCardFolder) return;

    const modelCardHTML = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Model Card: ${sessionName || DEFAULT_SESSION_NAME}</title>
        <style>
          body { font-family: sans-serif; margin: 20px; line-height: 1.6; background-color: #f4f4f4; color: #333; }
          .container { background-color: #fff; padding: 20px; border-radius: 8px; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
          h1, h2 { color: #333; border-bottom: 1px solid #eee; padding-bottom: 10px;}
          img { max-width: 100%; height: auto; border: 1px solid #ddd; border-radius: 4px; margin-bottom:15px;}
          .section { margin-bottom: 20px; }
          .section h2 { margin-top: 0; }
          pre { background-color: #eee; padding: 10px; border-radius: 4px; white-space: pre-wrap; word-wrap: break-word; }
          ul { padding-left: 20px; }
          li { margin-bottom: 5px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Model Card: ${sessionName || DEFAULT_SESSION_NAME}</h1>
          <div class="section">
            <h2>Whiteboard Content Analysis</h2>
            <pre>${analysisText}</pre>
          </div>
          <div class="section">
            <h2>Canvas Image</h2>
            <img src="canvas_image.png" alt="Whiteboard Canvas Image">
          </div>
          ${fullAppScreenshotBase64 ? `
          <div class="section">
            <h2>Full Application Screenshot</h2>
            <img src="full_app_screenshot.png" alt="Full Application Screenshot">
          </div>` : ''}
          <div class="section">
            <h2>Whiteboard Elements Data</h2>
            <p>Raw data of whiteboard elements is included in <code>whiteboard_elements.json</code>.</p>
          </div>
          <div class="section">
            <h2>Prompt Cards</h2>
            <p>A history of AI interactions (prompts and responses) from this session is included in the <code>prompt_cards/</code> directory as individual Markdown files.</p>
          </div>
          <div class="section">
            <h2>Application Metadata</h2>
            <p>Application metadata is included in <code>application_metadata.json</code>.</p>
            <p>ViewBox State at Save: X=${viewBoxX.toFixed(2)}, Y=${viewBoxY.toFixed(2)}, Zoom=${zoomLevel.toFixed(2)}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    modelCardFolder.file("model_card.html", modelCardHTML);
    modelCardFolder.file("canvas_image.png", imageBase64, { base64: true });
    if (fullAppScreenshotBase64) {
      modelCardFolder.file("full_app_screenshot.png", fullAppScreenshotBase64, { base64: true });
    }
    modelCardFolder.file("whiteboard_elements.json", JSON.stringify(elements, null, 2));
    
    const appMetadata = {
      name: "Co-Creation Canvas Session",
      version: "1.0", 
      sessionName: sessionName || DEFAULT_SESSION_NAME,
      savedAt: new Date().toISOString(),
      canvasRenderWidth,
      canvasRenderHeight,
      viewBoxX,
      viewBoxY,
      zoomLevel,
      elementCount: elements.length
    };
    modelCardFolder.file("application_metadata.json", JSON.stringify(appMetadata, null, 2));

    const promptCardsFolder = modelCardFolder.folder("prompt_cards");
    if (promptCardsFolder) {
        elements.forEach(element => {
            if (element.type === 'content-box' && (element.filename?.startsWith('Gemini_Response_') || element.filename?.startsWith('AI_Response_'))) {
                promptCardsFolder.file(element.filename, element.content);
            }
        });
    }
  }, [getCanvasImageBase64, getFullAppScreenshotBase64, elements, canvasRenderWidth, canvasRenderHeight, sessionName, viewBoxX, viewBoxY, zoomLevel]);

  const saveModelCard = useCallback(async () => {
    setIsModelCardGenerating(true);
    try {
      const zip = new JSZip();
      await addModelCardToZip(zip);

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const link = document.createElement('a');
      link.download = generateSafeFilename(`${sessionName || DEFAULT_SESSION_NAME}_ModelCard`, 'zip');
      link.href = URL.createObjectURL(zipBlob);
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (err) {
      console.error("Error generating ZIP for model card:", err);
      alert("Failed to generate Model Card ZIP file.");
    } finally {
      setIsModelCardGenerating(false);
    }
  }, [addModelCardToZip, sessionName]);


  const saveBriefcaseAsZip = useCallback(async () => {
    setIsBriefcaseSaving(true);
    try {
      const zip = new JSZip();
      
      // Add Model Card to the ZIP
      await addModelCardToZip(zip);

      const briefcaseFolder = zip.folder("briefcase");
      if (!briefcaseFolder) {
          alert("Failed to create briefcase folder in ZIP.");
          return;
      }

      const readmeContent = `# Project Briefcase: Co-Creation Canvas

## Overview
This briefcase contains the core strategic and technical documentation for the Co-Creation Canvas project. It serves as the "brain" of the application, providing context for AI collaboration and project evolution.

## Core Context Documents
*   **README.md**: This overview file.
*   **CONCEPT_PLAN.md**: The strategic roadmap and feature specification.
*   **PROGRESS_LOG.md**: A chronological record of achievements and milestones.
*   **AI_COLLABORATION_MODEL.md**: Definition of the AI's role and collaborative patterns.
*   **AI_COLLABORATION_MODEL_CARD.md**: Template and record of specific AI-assisted sessions.

## Technical Integration
The \`BRIEFCASE_DIGEST.json\` file aggregates the content of these documents into a machine-readable format, allowing the AI to maintain a consistent understanding of the project's state and goals.`;

      const conceptPlanContent = `# Concept Plan: Co-Creation Canvas

## 1. Vision & Core Objective
To create a fluid, AI-augmented digital whiteboard that transcends traditional "drawing tools" by acting as a collaborative partner in the creative process.

## 2. Key Implemented Features
*   **Infinite Canvas:** High-performance rendering with zoom and pan.
*   **Multi-Modal Input:** Support for freehand drawing, shapes, text, and image imports.
*   **AI Integration:** Real-time analysis of canvas content and contextual assistance.
*   **Briefcase Protocol:** A self-documenting system that preserves project context.
*   **Briefcase Model Card Integration:** Automatic generation of session-specific model cards within the briefcase.

## 3. Technical Architecture
*   **Frontend:** React with TypeScript and Tailwind CSS.
*   **Rendering:** HTML5 Canvas with optimized redraw cycles.
*   **AI Engine:** Integration with Gemini models for vision and text generation.

## 4. Export/Save Options
*   **Save Session:** Local JSON export of the canvas state.
*   **Save Image:** PNG export of the current view.
*   **Save Model Card:** Comprehensive ZIP export including analysis and assets.
*   **Save Briefcase:** Full project context export, now including the latest Model Card.`;

      const progressLogContent = `# Progress Log: Co-Creation Canvas

## Last Major Milestone / Current State
**Milestone:** Briefcase Model Card Integration
**Status:** Active Development / Refinement
**Date:** April 2026

## Recent Achievements
1.  **Briefcase Model Card Integration:** Successfully integrated the Model Card generation into the "Save Briefcase" functionality.
2.  **Enhanced Briefcase Protocol:** Refined the briefcase structure to include AI-specific session records.
3.  **Dynamic Context Aggregation:** Updated the \`BRIEFCASE_DIGEST.json\` to include the latest project documentation.
4.  **AI Collaboration Refinement:** Improved the AI's ability to analyze and summarize complex whiteboard sessions.
5.  **Multi-Modal Canvas Support:** Stabilized image imports and complex shape rendering.

## Upcoming Goals
*   Implement real-time collaborative editing.
*   Expand the AI persona library for specialized creative tasks.
*   Integrate advanced versioning for the briefcase protocol.`;

      const aiCollaborationModelContent = `# AI Collaboration Model: Co-Creation Canvas

## 1. The AI as a "Creative Peer"
The AI is not just a tool; it's a participant. It observes the canvas, understands the spatial relationships between elements, and offers suggestions that are contextually relevant.

## 2. Collaborative Patterns
*   **Observation:** The AI monitors the canvas state.
*   **Inspiration:** The AI generates visual or textual prompts based on current work.
*   **Refinement:** The AI helps clean up or organize complex whiteboard layouts.
*   **Documentation:** The AI automatically generates summaries and model cards to preserve the creative journey.

## 3. Interaction Design
Interactions are designed to be non-intrusive. The AI provides "Prompt Cards" that the user can choose to engage with, ensuring the user remains in control of the creative flow.`;

      const briefcaseProtocolContent = `# Standardized Project Context Management Protocol (Project Briefcase)

## 1. Introduction & Purpose

The "Project Briefcase" is a curated set of documents designed to maintain a persistent and evolving context for any given project. Its primary purpose is to:

*   **Ensure Continuity:** Provide a shared understanding of the project's vision, progress, and interaction models, especially across different development sessions or when working with AI assistants that may have limited conversational memory.
*   **Facilitate AI Collaboration:** Equip AI assistants with the necessary background information to engage in deep, co-creative discussions, offer relevant suggestions, and contribute effectively to the project.
*   **Track Evolution:** Serve as a living record of the project's journey, key decisions, and future aspirations.

This protocol outlines how to manage and utilize the briefcase contents effectively.

## 2. Briefcase Contents

The briefcase, typically located in a \`briefcase/\` directory (or a similarly named project-specific context directory), generally contains the following key files:

*   **\`README.md\`**:
    *   **Role:** Provides an overview of the briefcase system itself – its purpose, contents, and a summary of this usage protocol. This is the entry point to understanding how the briefcase is structured and used for the specific project.
*   **\`CONCEPT_PLAN.md\`**:
    *   **Role:** Contains the strategic, long-term vision for the project. It details the core architecture (if applicable), key implemented features or components, planned or potential future developments, and the guiding philosophies or objectives of the project.
*   **\`PROGRESS_LOG.md\`**:
    *   **Role:** Acts as a dynamic, operational journal of the project's progress. It typically includes the last major milestone achieved, the current development focus or area of work, a log of recent achievements, known issues or challenges, and identified next steps.
*   **\`AI_COLLABORATION_MODEL.md\`**:
    *   **Role:** Defines the agreed-upon interaction model and communication protocols between the human team members and the AI assistant. This might include AI persona guidelines (if applicable), preferred thinking frameworks, communication styles, and any specific engagement approaches for AI collaboration.
*   **\`AI_COLLABORATION_MODEL_CARD.md\`**:
    *   **Role:** A template and record of specific AI-assisted sessions, capturing analysis, visual assets, and technical metadata.
*   **\`BRIEFCASE_DIGEST.json\`**:
    *   **Role:** An automatically generated JSON file that aggregates the full content of the primary markdown files. This allows for easier programmatic parsing and ingestion of the briefcase context by an AI assistant.

## 3. Briefcase Management Protocol

Effective management of the briefcase is crucial for its utility.

### 3.1. Maintaining Context (Priming the AI)

At the beginning of a new development session, or whenever the AI's context needs to be refreshed:

1.  **Primary Method:** Provide the AI assistant with the **full content of \`BRIEFCASE_DIGEST.json\`**. This is the most efficient way for the AI to ingest the entire current context.
2.  **Alternative/Supplementary Method:**
    *   Provide the **full content of \`PROGRESS_LOG.md\`**. This gives the AI the most up-to-date operational status.
    *   Provide **relevant excerpts or a summary of \`CONCEPT_PLAN.md\`** tailored to the current session's goals or discussion points.

### 3.2. Updating Briefcase Documents

The briefcase documents are *living documents* and must be kept up-to-date to remain useful.

1.  **User Responsibility:**
    *   The **human team members are ultimately responsible for making actual modifications** to the core markdown files. This includes logging new progress, updating feature lists, refining concepts, etc.
2.  **AI's Role in Suggesting Updates:**
    *   The AI assistant can be actively involved in maintaining the briefcase by **suggesting updates, drafting new sections, or proposing revisions** to the documents.
3.  **Regenerating \`BRIEFCASE_DIGEST.json\`**:
    *   **Crucially, after any changes are made to the content of the source markdown files, the \`BRIEFCASE_DIGEST.json\` file MUST be regenerated.**

### 3.3. Packaging and Sharing the Briefcase

To ensure all collaborators (human or AI) have the latest context:

*   **Regularly Package:** Create an archive (e.g., a ZIP file) of the entire briefcase directory, especially after significant updates.
*   **Ensure Digest is Current:** Before packaging, always ensure \`BRIEFCASE_DIGEST.json\` has been regenerated to reflect the latest changes in the markdown files.
*   **Distribution:** Make this packaged briefcase readily available to all relevant parties or place it in a shared repository.

## 4. Key Principles for Briefcase Management

*   **Living Documents:** Treat all briefcase files as dynamic and subject to ongoing updates.
*   **Accuracy and Recency:** Strive to keep the information within the briefcase accurate and reflective of the latest project status. Outdated information diminishes its value.
*   **User Oversight:** While the AI can assist in drafting content, the human team is responsible for the final accuracy, integration, and physical saving of changes to the files.
*   **Consistent Regeneration of Digest:** Always regenerate \`BRIEFCASE_DIGEST.json\` after modifying any of its source markdown files.`;

      const briefcaseFiles: Record<string, string> = {
        "README.md": readmeContent,
        "CONCEPT_PLAN.md": conceptPlanContent,
        "PROGRESS_LOG.md": progressLogContent,
        "AI_COLLABORATION_MODEL.md": aiCollaborationModelContent,
        "briefcase_protocol.md": briefcaseProtocolContent,
        "AI_COLLABORATION_MODEL_CARD.md": `# AI Collaboration Model Card: [Session Name]

## 1. Session Overview
*   **Session Name:** [Session Name]
*   **Date:** [Date]
*   **AI Persona:** [Persona Name]
*   **Core Objective:** [Brief description of what was explored/created]

## 2. AI Collaboration Analysis
[This section will be populated with the AI-generated analysis of the canvas content at the time of saving.]

## 3. Visual Assets
*   **Canvas Image:** \`model_card/canvas_image.png\` (Snapshot of the entire logical canvas)
*   **Full App Screenshot:** \`model_card/full_app_screenshot.png\` (If available)

## 4. Technical Metadata
*   **Element Count:** [Number of elements]
*   **Canvas Dimensions:** [Width] x [Height]
*   **View State:** Zoom: [Zoom], Offset: ([X], [Y])

## 5. Prompt & Response History
Individual AI interactions are captured as "Prompt Cards" in the \`model_card/prompt_cards/\` directory. These provide a granular record of the co-creative dialogue.

## 6. Raw Data
The complete state of the whiteboard elements is preserved in \`model_card/whiteboard_elements.json\` for future import or analysis.`
      };

      for (const filename in briefcaseFiles) {
        if (Object.prototype.hasOwnProperty.call(briefcaseFiles, filename)) {
          briefcaseFolder.file(filename, briefcaseFiles[filename]);
        }
      }

      const briefcaseDigest = {
        projectName: "Co-Creation Canvas",
        lastUpdated: new Date().toISOString(),
        documents: {
          "README.md": readmeContent,
          "CONCEPT_PLAN.md": conceptPlanContent,
          "PROGRESS_LOG.md": progressLogContent,
          "AI_COLLABORATION_MODEL.md": aiCollaborationModelContent,
          "briefcase_protocol.md": briefcaseProtocolContent
        }
      };
      briefcaseFolder.file("BRIEFCASE_DIGEST.json", JSON.stringify(briefcaseDigest, null, 2));

      const appMetadata = {
        name: "Co-Creation Canvas Session Briefcase",
        version: "1.0",
        savedAt: new Date().toISOString(),
        sessionName: sessionName || DEFAULT_SESSION_NAME,
      };
      briefcaseFolder.file("briefcase_metadata.json", JSON.stringify(appMetadata, null, 2));

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const link = document.createElement('a');
      link.download = generateSafeFilename(`${sessionName || DEFAULT_SESSION_NAME}_Briefcase`, 'zip');
      link.href = URL.createObjectURL(zipBlob);
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (err) {
      console.error("Error generating Briefcase ZIP:", err);
      alert("Failed to generate Briefcase ZIP file.");
    } finally {
      setIsBriefcaseSaving(false);
    }
  }, [addModelCardToZip, sessionName]);
;


  const saveSession = useCallback(async () => {
    setIsSessionSaving(true);
    try {
      const sessionData = {
        sessionName: sessionName || DEFAULT_SESSION_NAME,
        elements: elements,
        viewBoxX: viewBoxX,
        viewBoxY: viewBoxY,
        zoomLevel: zoomLevel,
        createdAt: new Date().toISOString(),
        appVersion: "1.0" // Example version
      };
      const sessionJson = JSON.stringify(sessionData, null, 2);
      const blob = new Blob([sessionJson], { type: 'application/json' });
      const link = document.createElement('a');
      link.download = generateSafeFilename(sessionName || DEFAULT_SESSION_NAME, SESSION_FILE_EXTENSION);
      link.href = URL.createObjectURL(blob);
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (error) {
      console.error("Error saving session:", error);
      alert("Failed to save session.");
    } finally {
      setIsSessionSaving(false);
    }
  }, [sessionName, elements, viewBoxX, viewBoxY, zoomLevel]);


  const triggerImageImport = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.value = ""; // Allow re-selecting the same file
      fileInputRef.current.click();
    }
  }, []);

  const handleFileSelected = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();

    const fileExtension = `.${file.name.split('.').pop()?.toLowerCase() || ''}`;

    if (fileExtension === SESSION_FILE_EXTENSION) {
      reader.onload = (e) => {
        try {
          const sessionData = JSON.parse(e.target?.result as string);
          if (sessionData && Array.isArray(sessionData.elements) && typeof sessionData.sessionName === 'string') {
            clearCanvasElements(); // Clear existing canvas before loading
            setElements(sessionData.elements); // ElementManager's setElements
            onSessionNameChange(sessionData.sessionName); // ElementManager's onSessionNameChange
            
            const loadedZoomLevel = typeof sessionData.zoomLevel === 'number' ? sessionData.zoomLevel : DEFAULT_ZOOM_LEVEL;
            const loadedViewBoxX = typeof sessionData.viewBoxX === 'number' ? sessionData.viewBoxX : 0;
            const loadedViewBoxY = typeof sessionData.viewBoxY === 'number' ? sessionData.viewBoxY : 0;
            
            setViewBox(loadedViewBoxX, loadedViewBoxY); // CanvasView's setViewBox
            // Directly set zoom level without anchor point for session load
            const newZoom = Math.max(0.1, Math.min(loadedZoomLevel, 5.0)); // MIN_ZOOM_LEVEL, MAX_ZOOM_LEVEL
            setZoomLevel(newZoom); // CanvasView's setZoomLevel

            setSelectedElementId(null);
            setCurrentTool(Tool.SELECT);
            alert(`Session "${sessionData.sessionName}" loaded successfully.`);
          } else {
            throw new Error("Invalid session file format.");
          }
        } catch (error) {
          console.error("Error loading session:", error);
          alert(`Failed to load session file. Error: ${(error as Error).message}`);
        }
      };
      reader.readAsText(file);
      return; 
    }
    
    if (SUPPORTED_TEXT_IMPORT_EXTENSIONS[fileExtension]) {
      reader.onload = (e) => {
        const textContent = e.target?.result as string;
        const newContentBox: ContentBoxElement = {
          id: `imported-text-${Date.now()}`,
          type: 'content-box',
          x: viewBoxX + 50, 
          y: viewBoxY + 50, 
          width: DEFAULT_CONTENT_BOX_WIDTH,
          height: DEFAULT_CONTENT_BOX_HEIGHT,
          contentType: SUPPORTED_TEXT_IMPORT_EXTENSIONS[fileExtension],
          filename: file.name,
          content: textContent,
          backgroundColor: DEFAULT_CONTENT_BOX_BACKGROUND_COLOR,
          textColor: DEFAULT_CONTENT_BOX_TEXT_COLOR,
          fontSize: DEFAULT_CONTENT_BOX_FONT_SIZE,
        };
        addElement(newContentBox);
        setSelectedElementId(newContentBox.id);
        setCurrentTool(Tool.SELECT);
         if (aiHook.triggerAutomaticSummaryGeneration) { // Call from aiHook
            aiHook.triggerAutomaticSummaryGeneration(newContentBox);
        }
      };
      reader.readAsText(file);
    } else if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'].includes(fileExtension)) {
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        const img = new Image();
        img.onload = () => {
          const aspectRatio = img.naturalWidth / img.naturalHeight;
          let width = Math.min(img.naturalWidth, canvasRenderWidth * 0.5);
          let height = width / aspectRatio;
          if (height > canvasRenderHeight * 0.5) {
            height = canvasRenderHeight * 0.5;
            width = height * aspectRatio;
          }
          const newImageElement: ImageElement = {
            id: `imported-image-${Date.now()}`, type: 'image', src: dataUrl,
            x: viewBoxX + (canvasRenderWidth - width) / 2,
            y: viewBoxY + (canvasRenderHeight - height) / 2,
            width, height,
            naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight,
          };
          addElement(newImageElement);
          setSelectedElementId(newImageElement.id);
          setCurrentTool(Tool.SELECT);
          if (aiHook.triggerAutomaticSummaryGeneration) { // Call from aiHook
            aiHook.triggerAutomaticSummaryGeneration(newImageElement);
          }
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    } else {
      alert(`Unsupported file type: ${file.name}. Please select an image or text file listed in constants.`);
    }
  }, [addElement, canvasRenderWidth, canvasRenderHeight, setCurrentTool, setSelectedElementId, viewBoxX, viewBoxY, aiHook, clearCanvasElements, setElements, onSessionNameChange, setViewBox, setZoomLevel]);

  return {
    saveCanvasAsImage,
    saveModelCard,
    saveBriefcaseAsZip,
    triggerImageImport,
    fileInputRef,
    handleFileSelected,
    acceptedFileTypes,
    isModelCardGenerating,
    isBriefcaseSaving,
    saveSession,
    isSessionSaving,
  };
};
