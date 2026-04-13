// FILENAME: src/commands/RemoveElementCommand.ts - VERSION: v1
import { Command, WhiteboardElement } from '../../types';

export class RemoveElementCommand implements Command {
  private elementToRemove: WhiteboardElement;
  private originalIndex: number;
  private setElements: (updater: (prevElements: WhiteboardElement[]) => WhiteboardElement[]) => void;
  private setSelectedElementId: (id: string | null) => void;
  private previouslySelectedId: string | null;

  constructor(
    elementToRemove: WhiteboardElement,
    originalIndex: number,
    setElements: (updater: (prevElements: WhiteboardElement[]) => WhiteboardElement[]) => void,
    setSelectedElementId: (id: string | null) => void,
    currentSelectedId: string | null
  ) {
    this.elementToRemove = elementToRemove;
    this.originalIndex = originalIndex;
    this.setElements = setElements;
    this.setSelectedElementId = setSelectedElementId;
    this.previouslySelectedId = currentSelectedId;
  }

  execute(): void {
    this.setElements(prevElements => prevElements.filter(el => el.id !== this.elementToRemove.id));
    if (this.previouslySelectedId === this.elementToRemove.id) {
        this.setSelectedElementId(null);
    }
  }

  undo(): void {
    this.setElements(prevElements => {
      const newElements = [...prevElements];
      newElements.splice(this.originalIndex, 0, this.elementToRemove);
      return newElements;
    });
    // Optionally restore selection if needed, though typically undoing removal doesn't reselect.
    // If it was the selected one, it might be logical to select it again.
     if (this.previouslySelectedId === this.elementToRemove.id) {
        this.setSelectedElementId(this.elementToRemove.id);
    }
  }
}
