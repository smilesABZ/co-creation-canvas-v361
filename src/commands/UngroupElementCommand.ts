// FILENAME: src/commands/UngroupElementCommand.ts - VERSION: v1
import { Command, WhiteboardElement, GroupElement } from '../../types';

export class UngroupElementCommand implements Command {
  private groupElement: GroupElement;
  private originalChildElements: WhiteboardElement[]; // Store full state for redo
  private setElements: (updater: (prevElements: WhiteboardElement[]) => WhiteboardElement[]) => void;
  private setSelectedElementId: (id: string | null) => void;
  private setMultiSelectedElementIds: (ids: string[]) => void;

  constructor(
    groupElement: GroupElement,
    originalChildElements: WhiteboardElement[],
    setElements: (updater: (prevElements: WhiteboardElement[]) => WhiteboardElement[]) => void,
    setSelectedElementId: (id: string | null) => void,
    setMultiSelectedElementIds: (ids: string[]) => void
  ) {
    this.groupElement = { ...groupElement };
    this.originalChildElements = originalChildElements.map(el => ({ ...el })); // Deep copy
    this.setElements = setElements;
    this.setSelectedElementId = setSelectedElementId;
    this.setMultiSelectedElementIds = setMultiSelectedElementIds;
  }

  execute(): void {
    this.setElements(prevElements => {
      return prevElements
        .filter(el => el.id !== this.groupElement.id)
        .map(el => {
          if (this.groupElement.childElementIds.includes(el.id)) {
            const { groupId, ...rest } = el as any; // Remove groupId
            return rest as WhiteboardElement;
          }
          return el;
        });
    });
    this.setMultiSelectedElementIds(this.groupElement.childElementIds);
    this.setSelectedElementId(null);
  }

  undo(): void {
    this.setElements(prevElements => {
      const elementsWithoutChildren = prevElements.filter(
        el => !this.groupElement.childElementIds.includes(el.id)
      );
      // Add back the original children with their groupIds restored
      const childrenWithGroupIds = this.originalChildElements.map(child => ({
        ...child,
        groupId: this.groupElement.id,
      }));
      return [...elementsWithoutChildren, ...childrenWithGroupIds, { ...this.groupElement }];
    });
    this.setSelectedElementId(this.groupElement.id);
    this.setMultiSelectedElementIds([]);
  }
}
