// FILENAME: src/commands/AddElementCommand.ts - VERSION: v2 (Refined Selection)
import { Command, WhiteboardElement } from '../../types';

export class AddElementCommand implements Command {
  private elementToAdd: WhiteboardElement;
  private setElements: (updater: (prevElements: WhiteboardElement[]) => WhiteboardElement[]) => void;
  private setSelectedElementId: (id: string | null) => void;
  private previousSelectedId: string | null = null; // Store what was selected before this command

  constructor(
    elementToAdd: WhiteboardElement,
    setElements: (updater: (prevElements: WhiteboardElement[]) => WhiteboardElement[]) => void,
    setSelectedElementId: (id: string | null) => void,
    getCurrentlySelectedId?: () => string | null // Optional getter for current selection
  ) {
    this.elementToAdd = elementToAdd;
    this.setElements = setElements;
    this.setSelectedElementId = setSelectedElementId;
    if (getCurrentlySelectedId) {
        this.previousSelectedId = getCurrentlySelectedId();
    }
  }

  execute(): void {
    // Before adding, capture current selection if not already done via constructor
    // This is more for complex scenarios; direct constructor passing is usually fine.
    // this.previousSelectedId = this.previousSelectedId === null && typeof (window as any).getCurrentSelection === 'function' ? (window as any).getCurrentSelection() : this.previousSelectedId;


    this.setElements(prevElements => [...prevElements, this.elementToAdd]);
    // Only set selected ID if it's a non-group element, or if group selection is desired after creation.
    // For now, new elements (including groups) become selected.
    this.setSelectedElementId(this.elementToAdd.id);
  }

  undo(): void {
    this.setElements(prevElements => prevElements.filter(el => el.id !== this.elementToAdd.id));
    // Restore previous selection, or set to null if the undone element was the one selected.
    if (this.previousSelectedId && this.previousSelectedId !== this.elementToAdd.id) {
        this.setSelectedElementId(this.previousSelectedId);
    } else {
        this.setSelectedElementId(null);
    }
  }
}
