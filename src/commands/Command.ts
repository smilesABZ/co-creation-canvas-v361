// FILENAME: src/commands/Command.ts - VERSION: v1
import { WhiteboardElement } from '../../types';

export interface Command {
  execute: () => void;
  undo: () => void;
}
