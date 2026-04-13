// FILENAME: src/commands/GroupElementsCommand.ts - VERSION: v1
import { Command, WhiteboardElement, GroupElement } from '../../types';

export class GroupElementsCommand implements Command {
  private childElementIds: string[];
  private groupElement: GroupElement;
  private setElements: (updater: (prevElements: WhiteboardElement[]) => WhiteboardElement[]) => void;
  private setSelectedElementId: (id: string | null) => void;
  private setMultiSelectedElementIds: (ids: string[]) => void;
  private originalChildGroupIds: Map<string, string | undefined>;
  private previouslyMultiSelectedIds: string[];

  constructor(
    childElementIds: string[],
    groupElement: GroupElement,
    setElements: (updater: (prevElements: WhiteboardElement[]) => WhiteboardElement[]) => void,
    setSelectedElementId: (id: string | null) => void,
    setMultiSelectedElementIds: (ids: string[]) => void,
    getElements: () => WhiteboardElement[] // To get current state for undo
  ) {
    this.childElementIds = [...childElementIds];
    this.groupElement = { ...groupElement };
    this.setElements = setElements;
    this.setSelectedElementId = setSelectedElementId;
    this.setMultiSelectedElementIds = setMultiSelectedElementIds;
    this.originalChildGroupIds = new Map();
    this.previouslyMultiSelectedIds = [...childElementIds]; // Save for undo

    const currentElements = getElements();
    this.childElementIds.forEach(id => {
      const child = currentElements.find(el => el.id === id);
      if (child) {
        this.originalChildGroupIds.set(id, (child as any).groupId);
      }
    });
  }

  execute(): void {
    this.setElements(prevElements => {
      const newElements = prevElements.map(el => {
        if (this.childElementIds.includes(el.id)) {
          return { ...el, groupId: this.groupElement.id };
        }
        return el;
      });
      return [...newElements, { ...this.groupElement }];
    });
    this.setSelectedElementId(this.groupElement.id);
    this.setMultiSelectedElementIds([]);
  }

  undo(): void {
    this.setElements(prevElements => {
      const restoredElements = prevElements
        .filter(el => el.id !== this.groupElement.id)
        .map(el => {
          if (this.childElementIds.includes(el.id)) {
            return { ...el, groupId: this.originalChildGroupIds.get(el.id) };
          }
          return el;
        });
      return restoredElements;
    });
    this.setMultiSelectedElementIds(this.previouslyMultiSelectedIds);
    this.setSelectedElementId(null);
  }
}
