// FILENAME: src/commands/UpdateElementsCommand.ts - VERSION: v1
import { Command, WhiteboardElement } from '../../types';

export class UpdateElementsCommand implements Command {
  private previousStates: WhiteboardElement[];
  private newStates: WhiteboardElement[];
  private setElements: (updater: (prevElements: WhiteboardElement[]) => WhiteboardElement[]) => void;

  constructor(
    previousStates: WhiteboardElement[],
    newStates: WhiteboardElement[],
    setElements: (updater: (prevElements: WhiteboardElement[]) => WhiteboardElement[]) => void
  ) {
    this.previousStates = previousStates;
    this.newStates = newStates;
    this.setElements = setElements;
  }

  execute(): void {
    this.setElements(prevElements => {
      const newElementsMap = new Map(this.newStates.map(el => [el.id, el]));
      return prevElements.map(el => newElementsMap.get(el.id) || el);
    });
  }

  undo(): void {
    this.setElements(prevElements => {
      const previousElementsMap = new Map(this.previousStates.map(el => [el.id, el]));
      return prevElements.map(el => previousElementsMap.get(el.id) || el);
    });
  }
}
