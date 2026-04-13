// FILENAME: src/features/ai/aiService.ts - VERSION: v1 (Multi-Provider Support)
import { GoogleGenAI, GenerateContentResponse, GenerateContentParameters, GroundingMetadata } from "@google/genai";
import { AiResponse, AiPersona, ShapeType, Tool, SHAPE_TYPE_VALUES, LineStyle, AiConfig } from '../../../types';
import { COLORS, STROKE_WIDTHS, EMOJI_LIST, AI_PERSONAS_LIST, ALL_SUPPORTED_IMPORT_EXTENSIONS, DEFAULT_FONT_SIZE, DEFAULT_FONT_FAMILY, TRANSPARENT_FILL_VALUE, DEFAULT_CONTENT_BOX_FONT_SIZE, LINE_STYLES } from '../../../constants';

// Configuration from environment - used as defaults
const DEFAULT_AI_PROVIDER = (process.env.AI_PROVIDER as any) || 'gemini';
const DEFAULT_LOCAL_AI_BASE_URL = process.env.LOCAL_AI_BASE_URL || 'http://localhost:11434';
const DEFAULT_LOCAL_AI_MODEL = process.env.LOCAL_AI_MODEL || 'llama3';

export const DEFAULT_AI_CONFIG: AiConfig = {
  provider: DEFAULT_AI_PROVIDER,
  localAiBaseUrl: DEFAULT_LOCAL_AI_BASE_URL,
  localAiModel: DEFAULT_LOCAL_AI_MODEL,
};

// Initialize Gemini if API key is available
const genAi = process.env.API_KEY ? new GoogleGenAI({ apiKey: process.env.API_KEY }) : null;

export const GEMINI_MULTIMODAL_MODEL = 'gemini-3-flash-preview';
export const GEMINI_MODEL_TEXT_ONLY = 'gemini-3-flash-preview';

interface SystemInstructionDetails {
  instruction: string;
  modelConfigOverride?: Partial<GenerateContentParameters['config']>;
}

const getMenuOptionsJSONString = (canvasWidth: number, canvasHeight: number): string => {
  const menuOptions = {
    applicationInfo: {
      name: "Whiteboard AI Assistant",
      description: "An interactive digital whiteboard application where users can draw, write, add shapes, and use AI to analyze or generate content.",
      canvasWidth: canvasWidth,
      canvasHeight: canvasHeight,
    },
    tools: [
      { id: Tool.SELECT, name: "Select Tool", shortcutHint: "S", description: "Select, move, and resize elements on the canvas.", uiPath: ["Tools Menu", "Main Tools"] },
      { id: Tool.PAN, name: "Pan Tool", shortcutHint: "M", description: "Pan or scroll the canvas view.", uiPath: ["Tools Menu", "Main Tools"] },
      { id: Tool.PENCIL, name: "Pencil Tool", shortcutHint: "P", description: "Draw freehand paths.", commandTypeHint: "path", uiPath: ["Tools Menu", "Main Tools"] },
      { id: Tool.TEXT, name: "Text Box Tool", shortcutHint: "T", description: "Add resizable content boxes with text to the canvas.", commandTypeHint: "text", uiPath: ["Tools Menu", "Main Tools"] },
      { id: Tool.URL, name: "URL Tool", description: "Add a display for a URL to the canvas.", commandTypeHint: "url", uiPath: ["Tools Menu", "Main Tools"] },
      { id: Tool.ERASER, name: "Eraser Tool", shortcutHint: "E", description: "Erase elements on the canvas.", uiPath: ["Tools Menu", "Utility Tools"] },
      { id: Tool.RECTANGLE, name: "Rectangle Tool", shortcutHint: "R", description: "Draw a rectangle shape.", commandTypeHint: "flowchart-shape", shapeType: "rectangle" as ShapeType, uiPath: ["Tools Menu", "Shape Tools"] },
      { id: Tool.OVAL, name: "Oval Tool", shortcutHint: "O", description: "Draw an oval shape.", commandTypeHint: "flowchart-shape", shapeType: "oval" as ShapeType, uiPath: ["Tools Menu", "Shape Tools"] },
      { id: Tool.DIAMOND, name: "Diamond Tool", shortcutHint: "D", description: "Draw a diamond shape.", commandTypeHint: "flowchart-shape", shapeType: "diamond" as ShapeType, uiPath: ["Tools Menu", "Shape Tools"] },
      { id: Tool.TRIANGLE, name: "Triangle Tool", description: "Draw a triangle shape.", commandTypeHint: "flowchart-shape", shapeType: "triangle" as ShapeType, uiPath: ["Tools Menu", "Shape Tools"] },
      { id: Tool.PARALLELOGRAM, name: "Parallelogram Tool", description: "Draw a parallelogram shape.", commandTypeHint: "flowchart-shape", shapeType: "parallelogram" as ShapeType, uiPath: ["Tools Menu", "Shape Tools"] },
      { id: Tool.HEXAGON, name: "Hexagon Tool", description: "Draw a hexagon shape.", commandTypeHint: "flowchart-shape", shapeType: "hexagon" as ShapeType, uiPath: ["Tools Menu", "Shape Tools"] },
      { id: Tool.CYLINDER, name: "Cylinder Tool", description: "Draw a cylinder shape.", commandTypeHint: "flowchart-shape", shapeType: "cylinder" as ShapeType, uiPath: ["Tools Menu", "Shape Tools"] },
      { id: Tool.CLOUD, name: "Cloud Tool", description: "Draw a cloud shape.", commandTypeHint: "flowchart-shape", shapeType: "cloud" as ShapeType, uiPath: ["Tools Menu", "Shape Tools"] },
      { id: Tool.STAR, name: "Star Tool", description: "Draw a star shape.", commandTypeHint: "flowchart-shape", shapeType: "star" as ShapeType, uiPath: ["Tools Menu", "Shape Tools"] },
      { id: Tool.ARROW, name: "Arrow/Line Tool", shortcutHint: "A", description: "Draw a connector arrow, plain line, or dotted line.", commandTypeHint: "connector", uiPath: ["Tools Menu", "Shape Tools"] },
      { id: Tool.EMOJI_STAMP, name: "Emoji Stamp Tool", shortcutHint: "J", description: "Place emojis on the canvas.", uiPath: ["Tools Menu", "Emoji Stamp (Opens Submenu)"] },
    ],
    shapeTypesAvailable: SHAPE_TYPE_VALUES,
    options: {
      colors: { list: COLORS, customFormat: "#RRGGBB (e.g., #FF0000 for red)", uiLocationHint: "Main Toolbar (Color Selection Area - includes swatches and color picker input)" },
      transparentFillToggle: { name: "Transparent Fill Toggle", value: TRANSPARENT_FILL_VALUE, description: "Toggles transparent fill for shapes.", uiLocationHint: "Main Toolbar (Color Selection Area, next to color picker)" },
      strokeWidths: { list: STROKE_WIDTHS, uiLocationHint: "Main Toolbar (Width Selection Area)" },
      lineStyles: { list: LINE_STYLES, defaultValue: "arrow", description: "Style for connector lines: 'arrow' (solid with arrowhead), 'plain' (solid, no arrowhead), or 'dotted' (dotted line, no arrowhead).", uiLocationHint: "Main Toolbar (Line Style Toggle, appears when Arrow/Line tool is selected)" },
      font: { defaultSize: DEFAULT_FONT_SIZE, defaultFamily: DEFAULT_FONT_FAMILY, formatExampleForOldTextElement: "16px Arial (Note: new text uses ContentBox with fontSize, URL tool uses default font size)" },
      emojis: { list: EMOJI_LIST.slice(0, 20), uiPath: ["Tools Menu", "Emoji Stamp (Opens Submenu)"] }, // Provide a subset to keep prompt shorter
      aiPersonas: { list: AI_PERSONAS_LIST.map(p => ({ id: p.id, name: p.name, description: p.description })), uiPath: ["Tools Menu", "AI Persona Selector (Opens Submenu)"] },
    },
    actions: [
      { name: "Import File", shortcutHint: "I", description: "Import images or text files.", supportedFileTypes: ALL_SUPPORTED_IMPORT_EXTENSIONS, uiLocationHint: "Main Toolbar (Button, Left Group)" },
      { name: "Clear Canvas", shortcutHint: "C", description: "Remove all elements from the canvas.", uiLocationHint: "Main Toolbar (Button, Left Group)" },
      { name: "Mermaid Diagram", description: "Open modal to create diagrams with Mermaid syntax.", uiPath: ["Tools Menu", "Utility Tools"] },
      { name: "Analyze Whiteboard", description: "Get an AI analysis of the current whiteboard content.", uiLocationHint: "Main Toolbar (Button, Right Action Group)" },
      { name: "Interact with AI", description: "Open a dialog to chat with AI for drawing or analysis.", uiLocationHint: "Main Toolbar (Button, Right Action Group)" },
      { name: "Save Image", description: "Save the current canvas content as a PNG image.", uiLocationHint: "Main Toolbar (Button, Right Action Group)" },
      { name: "Save Card", description: "Save a model card (ZIP) containing canvas image, data, and analysis.", uiLocationHint: "Main Toolbar (Button, Right Action Group)" },
    ],
    sessionManagement: {
        sessionNameInput: { name: "Session Name Input", description: "Input field to edit the current session name.", uiLocationHint: "Main Toolbar (Far Right)" }
    },
    drawingCommandSchemaReminder: {
      description: "Your response for drawing or modification should be a JSON object with an optional 'analysisText' (string) and a 'drawings' (array) key. Each object in 'drawings' is a command.",
      commands: {
        path: { type: "path", points: "[{x,y},...]", color: "#RRGGBB", strokeWidth: "number" },
        text: {
          type: "text", // This creates a ContentBoxElement on the canvas.
          x: "number (top-left of content box)",
          y: "number (top-left of content box)",
          content: "string (the text content)",
          textColor: "#RRGGBB",
          fontSize: "number (e.g., 14, optional, defaults to application setting)",
          width: "number (optional, width of the content box, defaults to application setting)",
          height: "number (optional, height of the content box, defaults to application setting)",
          backgroundColor: "#RRGGBB or 'transparent' (optional, defaults to transparent)"
        },
        url: {
          type: "url",
          x: "number (top-left of URL display)",
          y: "number (top-left of URL display)",
          urlText: "string (the actual URL, e.g., 'https://www.example.com')",
          displayText: "string (optional, text to display instead of raw URL, e.g., 'Example Site')",
          textColor: "#RRGGBB (optional, defaults to application setting)",
          fontSize: "number (optional, e.g., 16, defaults to application setting)"
        },
        flowchartShape: { type: "flowchart-shape", shapeType: "ShapeType string", x: "number", y: "number", width: "number", height: "number", text: "string (optional)", fillColor: "#RRGGBB or 'transparent'", borderColor: "#RRGGBB (optional)", strokeWidth: "number (optional)" },
        connector: { type: "connector", startX: "number", startY: "number", endX: "number", endY: "number", color: "#RRGGBB", strokeWidth: "number (optional)", lineStyle: "'arrow', 'plain', or 'dotted' (optional, defaults to 'arrow')" },
        modifyElement: { type: "modify-element", target: "{id?, shapeType?, textContains?, color?}", modifications: "{select?, newX?, newY?, deltaX?, deltaY?, newWidth?, newHeight?}" }
      }
    }
  };
  return JSON.stringify(menuOptions, null, 2);
};

const getSystemInstruction = (
  canvasWidth: number,
  canvasHeight: number,
  persona: AiPersona
): SystemInstructionDetails => {
  let personaInstruction = `You are a helpful whiteboard assistant. The user has provided an image of the current whiteboard and a request.`;
  let modelConfigOverride: Partial<GenerateContentParameters['config']> | undefined = undefined;

  if (persona === 'mindless-robot') {
    personaInstruction = `You are a Mindless Robot. Your responses must be direct, concise, and purely logical.
If asked to draw, provide only the necessary drawing commands in the JSON 'drawings' array. Do NOT include any 'analysisText'.
If asked a question that does not involve drawing, provide only the direct answer in the 'analysisText' field. Do NOT provide 'drawings'.
Do not use conversational phrases, greetings, or elaborations.
If a request is ambiguous or cannot be fulfilled logically and minimally, respond with an error message in 'analysisText'.`;
    modelConfigOverride = {
      thinkingConfig: { thinkingBudget: 0 }
    };
  } else if (persona === 'architect') {
    personaInstruction = `You are a meticulous Architect. Your responses should focus on structure, clear diagrams, and logical flow.
When asked to draw, prioritize accuracy and proper representation of systems or plans.
Provide concise explanations focused on design and functionality.`;
  } else if (persona === 'artist') {
    personaInstruction = `You are an imaginative Artist. Your responses should be visually creative and expressive.
When asked to draw, explore different styles, colors, and compositions. Feel free to interpret requests abstractly.
Emphasize aesthetics and artistic intent in any explanations.`;
  } else if (persona === 'creative-designer') {
    personaInstruction = `You are an innovative Creative Designer. Your responses should offer creative solutions and design concepts.
Focus on user experience, aesthetics, and functionality.
When asked to draw, generate novel designs and visual ideas. Explain the design thinking behind your creations.`;
  }

  const menuOptionsJSON = getMenuOptionsJSONString(canvasWidth, canvasHeight);

  const commonInstructions = `The canvas dimensions are ${canvasWidth}px width and ${canvasHeight}px height. All coordinates and dimensions you provide must be within these bounds.

User's request will be provided in the prompt.

You have access to the following tools, options, and actions available in the whiteboard application. This information is provided to help you understand the application's capabilities and to generate valid and relevant commands.
The MENU_OPTIONS_JSON below also includes 'uiPath' (an array describing a conceptual path in a menu, like ["Tools Menu", "Shape Tools"]) or 'uiLocationHint' (a string describing general placement, like "Main Toolbar Button") for many items. If asked about where a feature is, use this information to describe its location structurally.
Within the 'tools' and 'actions' arrays in the MENU_OPTIONS_JSON, some items may include a 'shortcutHint' (e.g., a letter like 'P' for Pencil). If a user's request seems to refer to a tool or action by such a hint, use it to identify the intended item and proceed with generating the relevant drawing commands or understanding the action. You do not 'press' keys or execute shortcuts directly; these hints are for interpreting user intent.

MENU_OPTIONS_JSON:
${menuOptionsJSON}

Based on the image of the current whiteboard, the user's request, and the MENU_OPTIONS_JSON provided above:
1. If the request is a question, asks for analysis, or you cannot fulfill a drawing/modification request, provide a textual response in the 'analysisText' field of the JSON.
2. If the request asks you to draw or modify something, you MUST respond with a JSON object containing a 'drawings' key. This key should be an array of drawing or modification commands, adhering to the 'drawingCommandSchemaReminder' in the MENU_OPTIONS_JSON.
   You can also include an 'analysisText' field to accompany the action or explain it (unless you are the Mindless Robot and the request is for drawing).
   Each command must be an object with a 'type' field. Ensure all parameters (like shapeType, color, coordinates) are valid based on MENU_OPTIONS_JSON.

   Supported drawing command types are detailed in 'drawingCommandSchemaReminder'.
   - For 'path': points array, color, strokeWidth.
   - For 'text': This command creates a multi-line text box (ContentBoxElement). Properties are 'x', 'y' (top-left), 'content' (string), 'textColor', and optional 'fontSize', 'width', 'height', 'backgroundColor'. If width/height are not provided, defaults will be used. Text will wrap.
   - For 'url': This command creates a URL display element. Properties are 'x', 'y' (top-left), 'urlText' (the URL string), 'displayText' (optional), 'textColor' (optional), 'fontSize' (optional).
   - For 'flowchart-shape': shapeType (from 'shapeTypesAvailable'), x, y, width, height, text (optional), fillColor ('#RRGGBB' or '${TRANSPARENT_FILL_VALUE}'), borderColor (optional), strokeWidth (optional).
     (x, y) is top-left. Ensure x + width <= ${canvasWidth} and y + height <= ${canvasHeight}. Min width/height for shapes is generally 20px.
   - For 'connector': startX, startY, endX, endY, color, strokeWidth (optional), lineStyle ('arrow', 'plain', or 'dotted'; optional, defaults to 'arrow').

   Supported modification command type:
   - For 'modify-element': target (id?, shapeType?, textContains?, color?), modifications (select?, newX?, newY?, deltaX?, deltaY?, newWidth?, newHeight?).
     Use 'deltaX'/'deltaY' for relative moves. Use 'newX'/'newY' for absolute moves.
     Ensure new coordinates and dimensions are within canvas bounds.

3. **Interpreting Previous Responses:** The whiteboard image may contain content boxes that represent AI's previous responses. Treat these as part of the existing canvas state and historical context. Do not re-summarize previous outputs unless specifically asked to. Acknowledge them as part of the conversation history if relevant to the user's current request.
4. If you cannot fulfill the request reasonably, explain why in the 'analysisText' field.
5. If the user's request is specifically for analysis or summary, provide only 'analysisText'.

Example JSON for drawing and modifying:
{
  "analysisText": "Okay, I will add a red square and then select the existing blue circle and move it.",
  "drawings": [
    { "type": "flowchart-shape", "shapeType": "rectangle", "x": 50, "y": 50, "width": 80, "height": 80, "text": "New", "fillColor":"#FF0000" },
    {
      "type": "modify-element",
      "target": { "shapeType": "oval", "color": "#0000FF" },
      "modifications": { "select": true, "deltaX": 50, "deltaY": 0 }
    }
  ]
}

Respond ONLY with a valid JSON object adhering to this structure.
Do not use markdown like \`\`\`json ... \`\`\` to wrap the JSON response.
`;
  return {
    instruction: `${personaInstruction}\n${commonInstructions}`,
    modelConfigOverride
  };
};

const interactWithOllama = async (
  imageBase64: string,
  userPrompt: string,
  systemInstruction: string,
  config: AiConfig
): Promise<AiResponse> => {
  const url = `${config.localAiBaseUrl}/api/generate`;
  const prompt = `${systemInstruction}\n\nUser's request: "${userPrompt}"`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.localAiModel,
      prompt: prompt,
      images: [imageBase64],
      stream: false,
      format: 'json'
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama API error: ${response.statusText}`);
  }

  const data = await response.json();
  return JSON.parse(data.response);
};

const interactWithLMStudio = async (
  imageBase64: string,
  userPrompt: string,
  systemInstruction: string,
  config: AiConfig
): Promise<AiResponse> => {
  const url = `${config.localAiBaseUrl}/v1/chat/completions`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.localAiModel,
      messages: [
        { role: 'system', content: systemInstruction },
        {
          role: 'user',
          content: [
            { type: 'text', text: userPrompt },
            {
              type: 'image_url',
              image_url: { url: `data:image/png;base64,${imageBase64}` }
            }
          ]
        }
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' }
    }),
  });

  if (!response.ok) {
    throw new Error(`LM Studio API error: ${response.statusText}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;
  return JSON.parse(content);
};

/**
 * Helper to handle direct Gemini API calls with consistent error handling and retry logic.
 */
export const callGeminiDirectly = async (parameters: GenerateContentParameters, retries = 3, delay = 2000): Promise<GenerateContentResponse | { error: string }> => {
  if (!genAi) return { error: "Gemini AI not initialized." };
  
  try {
    return await genAi.models.generateContent(parameters);
  } catch (error: any) {
    const errorMessage = error.message || "An unknown error occurred.";
    const isQuotaError = errorMessage.toLowerCase().includes("quota") || errorMessage.toLowerCase().includes("limit") || errorMessage.includes("429");
    
    if (isQuotaError && retries > 0) {
      console.warn(`Gemini API quota hit. Retrying in ${delay}ms... (${retries} retries left)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return callGeminiDirectly(parameters, retries - 1, delay * 2);
    }

    console.error("Direct Gemini API Error:", error);
    let finalErrorMessage = errorMessage;
    if (isQuotaError) {
      finalErrorMessage = "Gemini API quota exceeded. Please wait a moment or check your API usage limits.";
    }
    return { error: finalErrorMessage };
  }
};

export const interactWithAI = async (
  imageBase64: string,
  userPrompt: string,
  currentCanvasWidth: number,
  currentCanvasHeight: number,
  persona: AiPersona,
  config: AiConfig = DEFAULT_AI_CONFIG,
  retries = 2,
  delay = 3000
): Promise<AiResponse> => {
  const { instruction: systemInstruction, modelConfigOverride } = getSystemInstruction(currentCanvasWidth, currentCanvasHeight, persona);

  if (config.provider === 'ollama') {
    try {
      return await interactWithOllama(imageBase64, userPrompt, systemInstruction, config);
    } catch (error: any) {
      console.error("Ollama Error:", error);
      if (error.message === 'Failed to fetch' || error.name === 'TypeError') {
        return { error: `Connection to Ollama failed. This is likely due to your browser blocking HTTP requests from an HTTPS site (Mixed Content) or a CORS issue. Please ensure Ollama is running, OLLAMA_ORIGINS="*" is set, and your browser allows mixed content for this site.` };
      }
      return { error: `Ollama error: ${error.message}` };
    }
  }

  if (config.provider === 'lm-studio') {
    try {
      return await interactWithLMStudio(imageBase64, userPrompt, systemInstruction, config);
    } catch (error: any) {
      console.error("LM Studio Error:", error);
      if (error.message === 'Failed to fetch' || error.name === 'TypeError') {
        return { error: `Connection to LM Studio failed. This is likely due to your browser blocking HTTP requests from an HTTPS site (Mixed Content) or a CORS issue. Please ensure LM Studio is running, CORS is enabled in its settings, and your browser allows mixed content.` };
      }
      return { error: `LM Studio error: ${error.message}` };
    }
  }

  // Default to Gemini
  if (!genAi) return { error: "Gemini AI not initialized." };

  try {
    const imagePart = {
      inlineData: {
        mimeType: 'image/png',
        data: imageBase64,
      },
    };
    const textPart = {
      text: `User's request: "${userPrompt}"`
    };

    const enableSearchGrounding = persona !== 'mindless-robot';

    const requestConfig: GenerateContentParameters['config'] = {
        systemInstruction: systemInstruction,
        ...(modelConfigOverride || {}),
    };

    if (enableSearchGrounding) {
        requestConfig.tools = [{googleSearch: {}}];
    } else {
        requestConfig.responseMimeType = "application/json";
    }

    const requestParameters: GenerateContentParameters = {
      model: GEMINI_MULTIMODAL_MODEL,
      contents: { parts: [imagePart, textPart] },
      config: requestConfig,
    };

    const genAiResponse = await callGeminiDirectly(requestParameters);
    
    if ('error' in genAiResponse) {
        return { error: genAiResponse.error };
    }

    let parsedData: AiResponse = {};
    let groundingMetadata: GroundingMetadata | undefined = undefined;

    if (enableSearchGrounding) {
        const firstCandidate = genAiResponse.candidates?.[0];
        if (firstCandidate && firstCandidate.groundingMetadata && Array.isArray(firstCandidate.groundingMetadata.groundingChunks)) {
            groundingMetadata = { groundingChunks: firstCandidate.groundingMetadata.groundingChunks };
        }
    }

    if (typeof genAiResponse.text === 'string' && genAiResponse.text.trim()) {
      let jsonStr = genAiResponse.text.trim();
      const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
      const match = jsonStr.match(fenceRegex);
      if (match && match[2]) {
        jsonStr = match[2].trim();
      }

      try {
        const attemptedParse = JSON.parse(jsonStr);
        if (typeof attemptedParse === 'object' && attemptedParse !== null &&
            (attemptedParse.hasOwnProperty('analysisText') || attemptedParse.hasOwnProperty('drawings') || attemptedParse.hasOwnProperty('error'))) {
            parsedData = attemptedParse as AiResponse;
            if (parsedData.drawings && !Array.isArray(parsedData.drawings)) {
                parsedData.drawings = [];
            }
        } else if (enableSearchGrounding) {
            parsedData.analysisText = jsonStr;
        } else {
            parsedData.error = "Invalid JSON response format.";
        }
      } catch (e) {
        if (enableSearchGrounding) {
            parsedData.analysisText = jsonStr;
        } else {
            parsedData.error = `Response was not valid JSON: "${jsonStr}"`;
        }
      }
    } else {
      parsedData.error = "Empty or invalid text response.";
    }

    if (groundingMetadata) {
        parsedData.groundingMetadata = groundingMetadata;
    }

    return parsedData;

  } catch (error: any) {
    console.error("Error in interactWithAI:", error);
    return { error: `Failed to interact with AI: ${error.message || "Unknown error"}` };
  }
};

/**
 * Generic text-only interaction for summaries and simple queries.
 */
export const interactWithAiTextOnly = async (
  prompt: string,
  systemInstruction: string,
  config: AiConfig = DEFAULT_AI_CONFIG
): Promise<string | { error: string }> => {
  if (config.provider === 'ollama') {
    try {
      const url = `${config.localAiBaseUrl}/api/generate`;
      const fullPrompt = `${systemInstruction}\n\n${prompt}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: config.localAiModel,
          prompt: fullPrompt,
          stream: false,
        }),
      });
      if (!response.ok) throw new Error(`Ollama API error: ${response.statusText}`);
      const data = await response.json();
      return data.response;
    } catch (error: any) {
      if (error.message === 'Failed to fetch' || error.name === 'TypeError') {
        return { error: `Connection to Ollama failed (Mixed Content / CORS). Ensure Ollama is running with OLLAMA_ORIGINS="*" and your browser allows mixed content.` };
      }
      return { error: `Ollama error: ${error.message}` };
    }
  }

  if (config.provider === 'lm-studio') {
    try {
      const url = `${config.localAiBaseUrl}/v1/chat/completions`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: config.localAiModel,
          messages: [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: prompt }
          ],
          temperature: 0.7,
        }),
      });
      if (!response.ok) throw new Error(`LM Studio API error: ${response.statusText}`);
      const data = await response.json();
      return data.choices[0].message.content;
    } catch (error: any) {
      if (error.message === 'Failed to fetch' || error.name === 'TypeError') {
        return { error: `Connection to LM Studio failed (Mixed Content / CORS). Ensure LM Studio is running, CORS is enabled, and your browser allows mixed content.` };
      }
      return { error: `LM Studio error: ${error.message}` };
    }
  }

  // Default to Gemini
  const requestParameters: GenerateContentParameters = {
    model: GEMINI_MODEL_TEXT_ONLY,
    contents: { parts: [{ text: prompt }] },
    config: {
      systemInstruction: systemInstruction,
      responseMimeType: "text/plain",
      temperature: 0.4,
    },
  };

  const response = await callGeminiDirectly(requestParameters);
  if ('error' in response) return response;
  return response.text || "";
};
