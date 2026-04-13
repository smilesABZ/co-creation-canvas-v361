<div align="center">
<img width="1200" height="475" alt="screenshot" src="https://github.com/smilesABZ/co-creation-canvas-v361/blob/main/full_app_screenshot.png" />
</div>

# Run and deploy the whiteboard, 1 per user

This contains everything you need to run your app locally, excluding Node.Js
## Setup

**Prerequisites:** Node.js 

The `node_modules` folder is not included in this repository (see `.gitignore`). You must install dependencies locally:



## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install` from cli

2. Run the app:
   `npm run dev` from cli

3. Connect to webpage on port xxxx, per your local setting

5. Select an Ai provider, gemini via api key , or ollama local, lm studio local


The app is a collaborative AI-powered whiteboard/canvas application built with React and TypeScript. 
Here's what it does:

Core Function
An interactive drawing and diagramming tool that combines:

Drawing & sketching — pencil, shapes, connectors, arrows, emoji stamps, text
AI assistance — integrated with Google Gemini to generate, analyze, and transform content
Smart features — undo/redo, grouping elements, resizing, panning, zooming, connector snapping

Key Capabilities
Canvas drawing — Shapes, lines, arrows, freehand drawing, eraser
Text handling — User-created text boxes, AI-generated text, imported files
Connectors — Smart arrows/lines that stick to elements when moved
AI features — Ask Gemini AI to generate diagrams, analyze drawings, create content
File operations — Save/export canvas, create model cards, manage sessions
Diagram support — Mermaid diagram creation and rendering
Web integration — Link elements that display URLs
Tech Stack
Frontend: React 19, TypeScript, Vite
AI: Google Gemini API (with support for Ollama/LM Studio)
Canvas: HTML5 Canvas API
Export: html2canvas for capturing drawings as images
It's designed as a custom-built, modular platform for collaborative ideation, planning, and diagramming with AI augmentation—think of it as a next-gen Miro or Figma-style whiteboard with built-in AI capabilities.
