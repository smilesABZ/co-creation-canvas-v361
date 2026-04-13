
// FILENAME: src/features/textEditing/useTextEditing.ts - VERSION: v3 (Simplified Callbacks)
import React, { useState, useCallback } from 'react';

export interface TextInputConfig {
  x: number;
  y: number;
  initialText?: string;
  color: string;
  fontSize: number;
  fontFamily: string;
  width?: number;
  height?: number;
  centerText?: boolean;
  targetId?: string;
  backgroundColor?: string;
  placeholder?: string; 
}

export interface TextEditingHook {
  isTextModeActive: boolean;
  textInputConfig: TextInputConfig | null;
  startTextEditing: (
    config: TextInputConfig,
    onSubmit?: (text: string) => void,
    onCancel?: () => void
  ) => void;
  cancelTextEditing: () => void;
  activeSubmit: ((text: string) => void) | null; 
  activeCancel: (() => void) | null; 
  setIsTextModeActive: React.Dispatch<React.SetStateAction<boolean>>;
  setTextInputConfig: React.Dispatch<React.SetStateAction<TextInputConfig | null>>;
}

export const useTextEditing = (): TextEditingHook => {
  const [isTextModeActive, setIsTextModeActive] = useState<boolean>(false);
  const [textInputConfig, setTextInputConfig] = useState<TextInputConfig | null>(null);
  
  const [activeSubmit, setActiveSubmit] = useState<((text: string) => void) | null>(null);
  const [activeCancel, setActiveCancel] = useState<(() => void) | null>(null);

  const startTextEditing = useCallback(
    (
      config: TextInputConfig,
      onSubmitHandler?: (text: string) => void,
      onCancelHandler?: () => void
    ) => {
      setTextInputConfig(config);
      setActiveSubmit(onSubmitHandler || null); // Store the handler directly
      setActiveCancel(onCancelHandler || null);   // Store the handler directly
      setIsTextModeActive(true);
    },
    [] // Dependencies are stable setters from useState, so empty array is fine.
  );

  const cancelTextEditing = useCallback(() => {
    setIsTextModeActive(false);
    setTextInputConfig(null);
    setActiveSubmit(null);
    setActiveCancel(null);
  }, []); // Dependencies are stable setters, empty array is fine.

  return {
    isTextModeActive,
    textInputConfig,
    startTextEditing,
    cancelTextEditing,
    activeSubmit, // Consumers will get the direct function or null
    activeCancel, // Consumers will get the direct function or null
    setIsTextModeActive,
    setTextInputConfig,
  };
};
