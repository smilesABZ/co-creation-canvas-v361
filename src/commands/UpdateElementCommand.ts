// FILENAME: src/commands/UpdateElementCommand.ts - VERSION: v1
import { Command, WhiteboardElement } from '../../types';

export class UpdateElementCommand implements Command {
  private previousElementState: WhiteboardElement;
  private newElementState: WhiteboardElement;
  private setElements: (updater: (prevElements: WhiteboardElement[]) => WhiteboardElement[]) => void;

  constructor(
    previousElementState: WhiteboardElement,
    newElementState: WhiteboardElement,
    setElements: (updater: (prevElements: WhiteboardElement[]) => WhiteboardElement[]) => void
  ) {
    this.previousElementState = previousElementState;
    this.newElementState = newElementState;
    this.setElements = setElements;
  }

  execute(): void {
    this.setElements(prevElements =>
      prevElements.map(el => (el.id === this.newElementState.id ? this.newElementState : el))
    );
  }

  undo(): void {
    this.setElements(prevElements =>
      prevElements.map(el => (el.id === this.previousElementState.id ? this.previousElementState : el))
    );
  }
}
