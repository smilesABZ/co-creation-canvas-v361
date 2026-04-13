// FILENAME: src/features/elementManager/useElementManager.ts - VERSION: v5 (Batch Update Command)
import React, { useState, useEffect, useCallback } from 'react';
import { WhiteboardElement, Command, GroupElement } from '../../../types'; 
import { DEFAULT_SESSION_NAME } from '../../../constants';
import { AddElementCommand } from '../../commands/AddElementCommand';
import { RemoveElementCommand } from '../../commands/RemoveElementCommand';
import { UpdateElementCommand } from '../../commands/UpdateElementCommand';
import { GroupElementsCommand } from '../../commands/GroupElementsCommand';
import { UngroupElementCommand } from '../../commands/UngroupElementCommand';
import { getElementBoundingBox } from '../canvas/canvasUtils';
import { UpdateElementsCommand } from '../../commands/UpdateElementsCommand';


export interface ElementManagerHook {
  elements: WhiteboardElement[];
  setElements: React.Dispatch<React.SetStateAction<WhiteboardElement[]>>; 
  addElement: (element: WhiteboardElement) => void;
  updateElement: (updatedElement: WhiteboardElement) => void; 
  removeElement: (elementId: string) => void;
  clearCanvasElements: () => void; 
  selectedElementId: string | null;
  setSelectedElementId: React.Dispatch<React.SetStateAction<string | null>>;
  
  multiSelectedElementIds: string[];
  setMultiSelectedElementIds: React.Dispatch<React.SetStateAction<string[]>>;
  toggleMultiSelectElement: (elementId: string) => void;
  clearMultiSelection: () => void;

  imageObjects: Record<string, HTMLImageElement>;
  getImageObject: (id: string) => HTMLImageElement | undefined;
  getElementById: (id: string) => WhiteboardElement | undefined;
  sessionName: string;
  onSessionNameChange: (name: string) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;

  groupSelectedElements: () => void;
  ungroupSelectedElement: () => void;
  commitBatchUpdate: (previousStates: WhiteboardElement[], newStates: WhiteboardElement[]) => void;
}

export const useElementManager = (): ElementManagerHook => {
  const [elementsInternalState, setElementsInternalState] = useState<WhiteboardElement[]>([]);
  const [selectedElementId, setSelectedElementIdInternal] = useState<string | null>(null);
  const [multiSelectedElementIds, setMultiSelectedElementIdsInternal] = useState<string[]>([]);
  const [imageObjects, setImageObjects] = useState<Record<string, HTMLImageElement>>({});
  const [sessionName, setSessionName] = useState<string>(DEFAULT_SESSION_NAME);

  const [undoStack, setUndoStack] = useState<Command[]>([]);
  const [redoStack, setRedoStack] = useState<Command[]>([]);

  const getElements = useCallback(() => elementsInternalState, [elementsInternalState]);

  const setElements = useCallback((newElements: WhiteboardElement[] | ((prevState: WhiteboardElement[]) => WhiteboardElement[])) => {
      setElementsInternalState(newElements);
  }, []);

  const setSelectedElementId = useCallback((id: string | null) => {
    setSelectedElementIdInternal(id);
    if (id !== null) { 
        setMultiSelectedElementIdsInternal([]);
    }
  }, []);

  const setMultiSelectedElementIds = useCallback((ids: string[]) => {
      setMultiSelectedElementIdsInternal(ids);
      if (ids.length > 0) { 
          setSelectedElementIdInternal(null);
      }
  }, []);

  const toggleMultiSelectElement = useCallback((elementId: string) => {
    setMultiSelectedElementIdsInternal(prev => {
        const newSelection = prev.includes(elementId)
            ? prev.filter(id => id !== elementId)
            : [...prev, elementId];
        if (newSelection.length > 0) setSelectedElementIdInternal(null);
        return newSelection;
    });
  }, []);

  const clearMultiSelection = useCallback(() => {
    setMultiSelectedElementIdsInternal([]);
  }, []);


  const executeCommand = useCallback((command: Command) => {
    command.execute();
    setUndoStack(prev => [...prev, command]);
    setRedoStack([]); 
  }, []);

  const addElement = useCallback((element: WhiteboardElement) => {
    const command = new AddElementCommand(
        element, 
        setElementsInternalState, 
        setSelectedElementIdInternal,
        () => selectedElementId 
    );
    executeCommand(command);
  }, [executeCommand, selectedElementId]);

  const updateElement = useCallback((updatedElement: WhiteboardElement) => {
    const currentElements = getElements();
    const currentElement = currentElements.find(el => el.id === updatedElement.id);
    if (currentElement) {
      const command = new UpdateElementCommand(currentElement, updatedElement, setElementsInternalState);
      executeCommand(command);
    }
  }, [getElements, executeCommand]);

  const commitBatchUpdate = useCallback((previousStates: WhiteboardElement[], newStates: WhiteboardElement[]) => {
    if (previousStates.length === 0 || newStates.length === 0) {
        return;
    }
    // The states are already set by the interaction manager. This command is just for history.
    // We call execute() to be consistent with redo.
    const command = new UpdateElementsCommand(previousStates, newStates, setElementsInternalState);
    executeCommand(command);
  }, [executeCommand]);

  const removeElement = useCallback((elementId: string) => {
    const currentElements = getElements();
    const elementToRemove = currentElements.find(el => el.id === elementId);
    
    if (elementToRemove) {
      // If deleting a group, also remove its children
      if (elementToRemove.type === 'group') {
        const group = elementToRemove as GroupElement;
        group.childElementIds.forEach(childId => {
          const childElement = currentElements.find(el => el.id === childId);
          if (childElement) {
            // This will create multiple RemoveElementCommands, or we need a specific GroupRemoveCommand
            // For now, let's assume RemoveElementCommand for each child first, then the group.
            // This might need a more sophisticated "CompoundCommand" or a specific "RemoveGroupAndChildrenCommand".
            // For simplicity in this step, we'll just remove them sequentially.
            // This will push multiple commands to undo stack, which is fine.
             const childIndex = getElements().findIndex(el => el.id === childId);
             if (childIndex !== -1) {
                const removeChildCmd = new RemoveElementCommand(childElement, childIndex, setElementsInternalState, setSelectedElementIdInternal, selectedElementId);
                executeCommand(removeChildCmd);
             }
          }
        });
      }
      const originalIndex = getElements().findIndex(el => el.id === elementId); // Re-fetch index after children removal
      if (originalIndex !== -1) {
        const command = new RemoveElementCommand(elementToRemove, originalIndex, setElementsInternalState, setSelectedElementIdInternal, selectedElementId);
        executeCommand(command);
      }
    }
  }, [getElements, executeCommand, selectedElementId]);

  const clearCanvasElements = useCallback(() => {
    setElementsInternalState([]);
    setSelectedElementIdInternal(null);
    setMultiSelectedElementIdsInternal([]);
    setImageObjects({});
    setUndoStack([]);
    setRedoStack([]);
  }, []);
  
  const undo = useCallback(() => {
    if (undoStack.length > 0) {
      const command = undoStack[undoStack.length - 1];
      command.undo();
      setUndoStack(prev => prev.slice(0, -1));
      setRedoStack(prev => [command, ...prev]);
    }
  }, [undoStack]);

  const redo = useCallback(() => {
    if (redoStack.length > 0) {
      const command = redoStack[0];
      command.execute(); 
      setRedoStack(prev => prev.slice(1));
      setUndoStack(prev => [...prev, command]);
    }
  }, [redoStack]);

  const onSessionNameChange = (name: string) => {
    setSessionName(name);
  };
  
  const getImageObject = useCallback((id: string) => imageObjects[id], [imageObjects]);

  const getElementById = useCallback((id: string): WhiteboardElement | undefined => {
    return getElements().find(el => el.id === id);
  }, [getElements]);

  const groupSelectedElements = useCallback(() => {
    if (multiSelectedElementIds.length <= 1) return;

    const currentElements = getElements();
    const childrenToGroup = currentElements.filter(el => multiSelectedElementIds.includes(el.id) && !(el as any).groupId);
    if (childrenToGroup.length <= 1) return; // Cannot group single elements or already grouped elements this way

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const tempCtx = document.createElement('canvas').getContext('2d'); // For bounding box calculation
    if (!tempCtx) return;

    childrenToGroup.forEach(el => {
      const bbox = getElementBoundingBox(el, tempCtx);
      if (bbox) {
        minX = Math.min(minX, bbox.x);
        minY = Math.min(minY, bbox.y);
        maxX = Math.max(maxX, bbox.x + bbox.width);
        maxY = Math.max(maxY, bbox.y + bbox.height);
      }
    });

    if (minX === Infinity) return; // No valid elements found

    const groupElement: GroupElement = {
      id: `group-${Date.now()}`,
      type: 'group',
      childElementIds: childrenToGroup.map(el => el.id),
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };

    const command = new GroupElementsCommand(
      groupElement.childElementIds,
      groupElement,
      setElementsInternalState,
      setSelectedElementIdInternal,
      setMultiSelectedElementIdsInternal,
      getElements
    );
    executeCommand(command);

  }, [multiSelectedElementIds, getElements, executeCommand]);

  const ungroupSelectedElement = useCallback(() => {
    if (!selectedElementId) return;
    const currentElements = getElements();
    const groupElement = currentElements.find(el => el.id === selectedElementId && el.type === 'group') as GroupElement | undefined;

    if (!groupElement) return;

    const originalChildElements = currentElements.filter(el => groupElement.childElementIds.includes(el.id));

    const command = new UngroupElementCommand(
      groupElement,
      originalChildElements,
      setElementsInternalState,
      setSelectedElementIdInternal,
      setMultiSelectedElementIdsInternal
    );
    executeCommand(command);

  }, [selectedElementId, getElements, executeCommand]);


  useEffect(() => {
    const currentElements = getElements();
    const newImageObjectsStateUpdate: Record<string, HTMLImageElement> = {};
    let changed = false;
    
    currentElements.forEach(el => {
      if (el.type === 'image' && el.src) {
        if (!imageObjects[el.id] || imageObjects[el.id].src !== el.src) {
          const img = new Image();
          img.onload = () => {
            setImageObjects(prev => ({ ...prev, [el.id]: img }));
          };
          img.onerror = () => {
            console.error(`Failed to load image for element ID: ${el.id}, SRC: ${el.src.substring(0,100)}...`);
             setImageObjects(prev => {
                const updated = {...prev};
                delete updated[el.id]; 
                return updated;
            });
          };
          img.src = el.src;
          newImageObjectsStateUpdate[el.id] = img; 
          changed = true;
        } else if (imageObjects[el.id]) {
          newImageObjectsStateUpdate[el.id] = imageObjects[el.id]; 
        }
      }
    });

    Object.keys(imageObjects).forEach(id => {
      if (!currentElements.find(el => el.type === 'image' && el.id === id)) {
        changed = true; 
      } else if (!newImageObjectsStateUpdate[id]) { 
        changed = true;
      }
    });

    if (changed) {
      const finalImageObjectsForState: Record<string, HTMLImageElement> = {};
      currentElements.forEach(el => {
        if (el.type === 'image') {
          if (newImageObjectsStateUpdate[el.id]) {
            finalImageObjectsForState[el.id] = newImageObjectsStateUpdate[el.id];
          } else if (imageObjects[el.id]) { 
            finalImageObjectsForState[el.id] = imageObjects[el.id];
          }
        }
      });
      setImageObjects(finalImageObjectsForState);
    }
  }, [getElements, imageObjects]); // Depends on elements via getElements

  return {
    elements: elementsInternalState,
    setElements, 
    addElement,
    updateElement,
    removeElement,
    clearCanvasElements,
    selectedElementId,
    setSelectedElementId,
    multiSelectedElementIds,
    setMultiSelectedElementIds,
    toggleMultiSelectElement,
    clearMultiSelection,
    imageObjects,
    getImageObject,
    getElementById, 
    sessionName,
    onSessionNameChange,
    undo,
    redo,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    groupSelectedElements,
    ungroupSelectedElement,
    commitBatchUpdate,
  };
};
