import React from 'react';
import React, { useState } from 'react';
import { AiConfig, AiProvider } from '../types';
import DraggableModal from './DraggableModal';

interface AiSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: AiConfig;
  onSave: (newConfig: AiConfig) => void;
}

const AiSettingsModal: React.FC<AiSettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  onSave,
}) => {
  const [provider, setProvider] = useState<AiProvider>(config.provider);
  const [localAiBaseUrl, setLocalAiBaseUrl] = useState(config.localAiBaseUrl);
  const [localAiModel, setLocalAiModel] = useState(config.localAiModel);

  const handleSave = () => {
    onSave({
      provider,
      localAiBaseUrl,
      localAiModel,
    });
  };

  return (
    <DraggableModal
      isOpen={isOpen}
      onClose={onClose}
      title="AI Configuration"
      width="400px"
      height="auto"
    >
      <div className="p-4 flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-semibold text-gray-700">AI Provider</label>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value as AiProvider)}
            className="p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="gemini">Google Gemini (Cloud)</option>
            <option value="ollama">Ollama (Local)</option>
            <option value="lm-studio">LM Studio (Local)</option>
          </select>
        </div>

        {(provider === 'ollama' || provider === 'lm-studio') && (
          <>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold text-gray-700">Base URL</label>
              <input
                type="text"
                value={localAiBaseUrl}
                onChange={(e) => setLocalAiBaseUrl(e.target.value)}
                placeholder={provider === 'ollama' ? "http://localhost:11434" : "http://localhost:1234"}
                className="p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <p className="text-xs text-gray-500">
                {provider === 'ollama' 
                  ? "Default Ollama URL is http://localhost:11434" 
                  : "Default LM Studio URL is http://localhost:1234"}
              </p>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold text-gray-700">Model Name</label>
              <input
                type="text"
                value={localAiModel}
                onChange={(e) => setLocalAiModel(e.target.value)}
                placeholder="e.g., llama3, mistral"
                className="p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md text-xs text-yellow-800">
              <strong>Note on Local Connections:</strong> Because this app is hosted on HTTPS, your browser may block requests to local HTTP servers (Mixed Content). 
              <ul className="list-disc ml-4 mt-1">
                <li>You may need to allow "Insecure Content" in your browser's site settings.</li>
                {provider === 'ollama' && <li>Ensure Ollama is running with the environment variable <code>OLLAMA_ORIGINS="*"</code> to allow CORS.</li>}
                {provider === 'lm-studio' && <li>Ensure CORS is enabled in LM Studio's server settings.</li>}
              </ul>
            </div>
          </>
        )}

        {provider === 'gemini' && (
          <p className="text-xs text-gray-500 italic">
            Gemini uses the API key configured in the environment.
          </p>
        )}

        <div className="flex justify-end gap-2 mt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors shadow-sm"
          >
            Save Configuration
          </button>
        </div>
      </div>
    </DraggableModal>
  );
};

export default AiSettingsModal;
