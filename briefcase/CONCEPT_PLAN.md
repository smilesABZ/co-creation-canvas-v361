# Co-Creation Canvas: Concept Plan

## 1. Application Vision
A modular, AI-assisted collaborative whiteboard designed for intuitive drawing, diagramming, text handling, and intelligent content generation/analysis via AI (including Google Gemini and local providers like Ollama or LM Studio). The focus is on a custom-built, extensible platform where features are implemented directly for learning, fine-grained control, and a unique user experience.

## 2. Core Architecture
-   **Frontend Framework:** React with TypeScript.
-   **UI Management:** React components for toolbar, modals, interactive elements.
-   **State Management:** Custom React hooks for modular functionality:
    -   `useToolManager`: Manages active tool, colors, stroke widths, fill options, emoji selection, line style (arrow/plain/dotted).
    -   `useElementManager`: Manages all whiteboard elements (paths, shapes, text, images, connectors, content boxes, URL elements, groups), selection state, and session name. Leverages a Command Pattern for undo/redo functionality.
    -   `useCanvasView`: Manages canvas panning (viewBox), coordinate transformations (virtual to viewport and vice-versa), and zoom functionality.
    -   `useTextEditing`: Manages state for inline text input overlay.
    -   `useInteractionManager`: Handles all mouse/touch events for drawing, selection, moving, resizing, panning, connector snapping, and group interactions. It efficiently manages complex operations like moving a group by treating them as a single atomic action for the undo/redo system.
    -   `useAi`: Manages interaction with AI providers (modals, prompts, processing responses, applying drawing commands, AI persona, per-element AI summaries). Supports Google Gemini, Ollama, and LM Studio.
    -   `useFileOperations`: Handles file import/export, saving canvas, model cards, briefcase, and sessions.
    -   `useMermaid`: Manages Mermaid diagram input, rendering, and editing.
-   **Rendering:** Direct HTML5 Canvas API for drawing all visual elements.
-   **Utilities:** Helper functions for geometry, color, and canvas drawing.
-   **External Libraries:** `@google/genai` (for Gemini), `JSZip`, `html2canvas`, `Mermaid`.

## 3. Key Implemented Features
-   **Drawing Tools:** Pencil (real-time), Eraser, various Flowchart Shapes, Arrow/Line (Connector), Emoji Stamp.
-   **Text Handling:** User-created text boxes, Gemini-generated text, imported text files, and text within shapes.
-   **URL Elements:** Support for displaying web links, creatable via Gemini commands.
-   **Element Manipulation:** Select, Move, Resize (for shapes, images, emojis, content boxes). Groups can also be selected and moved. All interactions are zoom-aware.
-   **Connectors:**
    -   Arrow, plain, or dotted line styles.
    -   Visual Connector Handles on attachable elements.
    -   Sticky Connectors: Connectors remain attached when elements are moved or resized.
-   **Grouping & Ungrouping:**
    -   Multiple selected elements can be grouped into a single selectable unit using a toolbar button or `Ctrl+G`.
    -   Groups can be ungrouped via a toolbar button or `Ctrl+Shift+G`.
    -   **Group Interactions:**
        -   **Selection:** Clicking any child element selects the entire parent group.
        -   **Movement:** Dragging a group moves the group bounding box, all child elements, and any attached connectors in unison.
    -   **Connectors:** Groups have connector attachment points, allowing them to be linked to other elements.
    -   **Undo/Redo Integration:** The group move operation is treated as a single, atomic action in the command history. This ensures that one "Undo" correctly reverts the entire move, making the feature robust and predictable.
-   **Zoom & Pan:** Comprehensive canvas zoom (buttons, mouse wheel) and pan functionality. All interactions are fully zoom-aware.
-   **Import Functionality:** Images and text files can be imported onto the canvas.
-   **Mermaid Diagram Integration:** Input Mermaid syntax via a modal and render it as an image on the canvas. Existing Mermaid diagrams can be edited.
-   **AI Integration (Multi-Provider):**
    -   **Provider Support:** Connect to Google Gemini (Cloud) or locally hosted AI via Ollama or LM Studio.
    -   **Canvas Image Context:** AI interactions use an image of the entire logical canvas content.
    -   Analyze whiteboard content, and interact via modal to request drawings or modifications.
    -   AI Persona selection.
    -   **Search Grounding:** Support for Google Search grounding (when using Gemini), with sources displayed.
    -   **Per-Element AI Summaries (Concise):** Automatic, concise summaries for elements, with UI controls for regeneration and visibility.
-   **Session Management:**
    -   Editable session name.
    -   **Save/Load Session:** Saves and loads the entire whiteboard state (elements, view, zoom) to a `.ccc` file.
-   **Undo/Redo (Command Pattern):** Implemented for most actions including element creation, deletion, updates, and grouping/ungrouping.
-   **Briefcase Model Card Integration:** Automatically generates and includes a comprehensive Model Card (analysis, images, data) within the "Save Briefcase" ZIP archive.
-   **Export/Save Options:** "Save Image", "Save Model Card" (standalone ZIP), and "Save Briefcase" (ZIP with project context and integrated Model Card).

## 4. Planned / Potential Future Features (Backlog Ideas)
-   **Core Functionality:**
    -   Copy/Paste elements.
    -   Layers for organizing content.
    -   Reinstate direct URL tool button in the main toolbar.
-   **Text & Content Enhancement:**
    -   Richer text editing options for `ContentBoxElement`.
-   **New Element Types:**
    -   Chart elements (Pie, Bar).
    -   Sticky notes.
-   **Advanced Gemini Commands:**
    -   "Arrange these items neatly."
-   **UI/UX Refinements:**
    -   Snapping elements to a grid or to each other.
    -   Improved accessibility.
    -   Touch gesture enhancements.

## 5. Design Philosophies
-   **Modularity & Extensibility:** Core functionality is broken down into manageable, reusable custom hooks.
-   **Direct Implementation Focus:** Preferring custom implementation for core whiteboard features.
-   **User-Centric Design:** Striving for an intuitive, responsive, and accessible user interface.
-   **AI as an Intelligent Assistant:** Leveraging AI (Cloud & Local) to enhance creativity and productivity.
-   **Iterative Development:** Building features incrementally.
-   **Briefcase for Context:** Utilizing a `briefcase` directory to maintain persistent project context.