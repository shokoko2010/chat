import React, { useState, useEffect } from 'react';
import Button from './ui/Button';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (keys: { gemini: string; stability: string }) => void;
  currentApiKey: string | null;
  currentStabilityApiKey: string | null;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onSave, currentApiKey, currentStabilityApiKey }) => {
  const [geminiKey, setGeminiKey] = useState('');
  const [stabilityKey, setStabilityKey] = useState('');

  useEffect(() => {
    if (isOpen) {
      setGeminiKey(currentApiKey || '');
      setStabilityKey(currentStabilityApiKey || '');
    }
  }, [currentApiKey, currentStabilityApiKey, isOpen]);

  if (!isOpen) {
    return null;
  }

  const handleSave = () => {
    onSave({ gemini: geminiKey, stability: stabilityKey });
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-6 w-full max-w-md fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-white">إعدادات واجهات برمجة التطبيقات (API)</h2>
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200">Google Gemini API</h3>
            <p className="mb-2 text-sm text-gray-600 dark:text-gray-300">
              لتفعيل ميزات النصوص والتحليل ومولّد صور Gemini.
            </p>
            <label htmlFor="gemini-api-key" className="sr-only">مفتاح Gemini API</label>
            <input
              id="gemini-api-key"
              type="password"
              value={geminiKey}
              onChange={(e) => setGeminiKey(e.target.value)}
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 focus:ring-blue-500 focus:border-blue-500"
              placeholder="أدخل مفتاح Gemini API هنا"
            />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200">Stability AI API</h3>
            <p className="mb-2 text-sm text-gray-600 dark:text-gray-300">
              لتفعيل مولّد صور Stability AI كخيار إضافي.
            </p>
            <label htmlFor="stability-api-key" className="sr-only">مفتاح Stability AI API</label>
            <input
              id="stability-api-key"
              type="password"
              value={stabilityKey}
              onChange={(e) => setStabilityKey(e.target.value)}
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 focus:ring-blue-500 focus:border-blue-500"
              placeholder="أدخل مفتاح Stability AI API هنا"
            />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            إلغاء
          </Button>
          <Button onClick={handleSave}>
            حفظ
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;