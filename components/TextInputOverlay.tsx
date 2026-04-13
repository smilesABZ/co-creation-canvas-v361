
// FILENAME: components/TextInputOverlay.tsx - VERSION: v3 (Placeholder Prop)
import React, { useState, useEffect, useRef } from 'react';

// TextInputConfig is now primarily defined and exported by useTextEditing.ts
// We define props for the component itself.
export interface TextInputOverlayProps {
  x: number;
  y: number;
  initialText?: string;
  color: string;
  fontSize: number;
  fontFamily: string;
  onSubmit: (text: string) => void; 
  onCancel: () => void; 
  width?: number; 
  height?: number; 
  centerText?: boolean; 
  backgroundColor?: string; 
  targetId?: string; 
  placeholder?: string; // New prop
}

const TextInputOverlay: React.FC<TextInputOverlayProps> = ({ 
  x, y, initialText = '', color, fontSize, fontFamily, onSubmit, onCancel,
  width, height, centerText, backgroundColor = 'rgba(255, 255, 255, 0.95)',
  placeholder
}) => {
  const [text, setText] = useState(initialText);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select(); 
      adjustTextareaHeight();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  const adjustTextareaHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'; 
      let newHeight = textareaRef.current.scrollHeight;
      if (height && newHeight > height - 10) { 
        newHeight = height - 10; // Leave some padding if max height is hit
        textareaRef.current.style.overflowY = 'auto';
      } else {
        textareaRef.current.style.overflowY = 'hidden';
      }
      textareaRef.current.style.height = `${newHeight}px`;
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    adjustTextareaHeight();
  };

  const handleSubmit = () => {
    onSubmit(text); // This will call either the custom onSubmit or the default one from App.tsx
  };

  const handleCancel = () => {
    onCancel(); // This will call either the custom onCancel or the default one (textEditing.cancelTextEditing)
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape') {
      e.preventDefault(); // Prevent other escape handlers if any
      handleCancel();
    }
  };

  const handleBlur = () => {
    // Standard behavior for text inputs is to submit on blur,
    // unless it's an explicit cancel (e.g., Escape key, which is handled by onKeyDown).
    // For multi-step inputs like URL, blur might imply cancellation of the current step.
    // However, the current `onSubmit` and `onCancel` props are generic.
    // If a custom `onCancel` is provided (like for URL tool), it should handle blur as cancel.
    // If `onSubmit` is the app's default text submission, it makes sense to submit on blur.
    // For the URL tool, `handleCancelUrlInput` (passed as `onCancel`) will clear state.
    // The current onSubmit (e.g., `handleSubmitUrlInput`) progresses.
    // This logic needs to be carefully managed by the provider of onSubmit/onCancel.
    // Defaulting to submit on blur is a common pattern.
    handleSubmit();
  }

  let topPos = y;
  if (height && textareaRef.current) {
    const currentTextareaHeight = textareaRef.current.scrollHeight;
    if (currentTextareaHeight < height) {
        topPos = y + (height - currentTextareaHeight) / 2;
    } else {
        topPos = y + 5; // Small padding if text fills the box
    }
  } else if (height) {
     // Approximate centering if textareaRef isn't ready but height is provided
     topPos = y + (height / 2) - (fontSize * 0.8); // Crude approximation
  }


  return (
    <textarea
      ref={textareaRef}
      value={text}
      onChange={handleTextChange}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur} 
      style={{
        position: 'absolute',
        left: `${x}px`,
        top: `${topPos}px`, 
        color: color,
        fontSize: `${fontSize}px`,
        fontFamily: fontFamily,
        border: '1px dashed #3B82F6', 
        outline: 'none',
        padding: '4px',
        boxSizing: 'border-box',
        width: width ? `${width}px` : 'auto',
        minWidth: '50px',
        maxWidth: width ? `${width}px` : '300px', // Default max width
        lineHeight: '1.2',
        background: backgroundColor,
        zIndex: 100, // Ensure it's above the canvas
        resize: 'none', // Typically, we don't want user resizing of this overlay
        overflowY: 'hidden', // Initial state, adjustTextareaHeight may change this
        textAlign: centerText ? 'center' : 'left',
      }}
      placeholder={placeholder || "Type..."} // Use provided placeholder or default
      rows={1} // Start with one row, will auto-expand
    />
  );
};

export default TextInputOverlay;
