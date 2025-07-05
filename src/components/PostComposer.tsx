import React, { useState } from 'react';
import Button from './ui/Button';
import PhotoIcon from './icons/PhotoIcon';
import SparklesIcon from './icons/SparklesIcon';
import { generatePostSuggestion } from '../services/geminiService';
import { GoogleGenAI } from '@google/genai';

interface PostComposerProps {
  onPublish: () => void;
  onSaveDraft: () => void;
  isPublishing: boolean;
  aiClient: GoogleGenAI | null;
  
  postText: string;
  onPostTextChange: (text: string) => void;

  onImageChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onImageRemove: () => void;
  imagePreview: string | null;
  
  isScheduled: boolean;
  onIsScheduledChange: (checked: boolean) => void;
  scheduleDate: string;
  onScheduleDateChange: (date: string) => void;

  error: string;
}

const PostComposer: React.FC<PostComposerProps> = (props) => {
  const {
      onPublish, onSaveDraft, isPublishing, aiClient,
      postText, onPostTextChange,
      onImageChange, onImageRemove, imagePreview,
      isScheduled, onIsScheduledChange,
      scheduleDate, onScheduleDateChange,
      error
  } = props;
  
  const [aiTopic, setAiTopic] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiError, setAiError] = useState('');

  const handleGenerateWithAI = async () => {
      if (!aiTopic.trim()) {
          setAiError('يرجى إدخال موضوع لتوليد منشور عنه.');
          return;
      }
      if (!aiClient) {
          setAiError('يرجى إضافة مفتاح API من قائمة الإعدادات لتفعيل هذه الميزة.');
          return;
      }
      setAiError('');
      setIsGenerating(true);
      try {
        const suggestion = await generatePostSuggestion(aiClient, aiTopic);
        onPostTextChange(suggestion);
      } catch (e: any) {
        setAiError(e.message || 'حدث خطأ غير متوقع.');
      } finally {
        setIsGenerating(false);
      }
  };
  
  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-white">إنشاء منشور</h2>
      
      <div className="mb-4 p-4 border border-blue-200 dark:border-blue-900 rounded-lg bg-blue-50 dark:bg-gray-700/50">
          <label htmlFor="ai-topic" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            مساعد الذكاء الاصطناعي ✨
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              id="ai-topic"
              type="text"
              value={aiTopic}
              onChange={(e) => setAiTopic(e.target.value)}
              placeholder="اكتب فكرة للمنشور، مثلاً: إطلاق منتج جديد"
              className="flex-grow p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 focus:ring-blue-500 focus:border-blue-500"
              disabled={isGenerating || !aiClient}
            />
            <Button onClick={handleGenerateWithAI} isLoading={isGenerating} disabled={!aiClient}>
              <SparklesIcon className="w-5 h-5 ml-2"/>
              {isGenerating ? 'جاري التوليد...' : 'ولّد لي نصاً'}
            </Button>
          </div>
          {aiError && <p className="text-red-500 text-sm mt-2">{aiError}</p>}
          {!aiClient && <p className="text-yellow-600 dark:text-yellow-400 text-sm mt-2">ميزة الذكاء الاصطناعي معطلة. افتح الإعدادات ⚙️ لإضافة مفتاح API الخاص بك.</p>}
      </div>

      <textarea
        value={postText}
        onChange={(e) => onPostTextChange(e.target.value)}
        placeholder="بماذا تفكر؟ اكتب منشورك هنا..."
        className="w-full h-48 p-3 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white transition"
      />

      {imagePreview && (
        <div className="mt-4 relative w-32">
          <img src={imagePreview} alt="Preview" className="rounded-lg w-full h-auto" />
          <button
            onClick={onImageRemove}
            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 leading-none"
            aria-label="Remove image"
          >
            &times;
          </button>
        </div>
      )}
      
      {error && <p className="text-red-500 text-sm mt-2">{error}</p>}

      <div className="mt-4 p-4 border rounded-lg dark:border-gray-700">
        <div className="flex items-center">
            <input 
                id="schedule-checkbox"
                type="checkbox" 
                checked={isScheduled}
                onChange={e => onIsScheduledChange(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
            <label htmlFor="schedule-checkbox" className="mr-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                جدولة المنشور
            </label>
        </div>
        {isScheduled && (
            <div className="mt-2">
                <input
                    type="datetime-local"
                    value={scheduleDate}
                    onChange={e => onScheduleDateChange(e.target.value)}
                    className="p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 focus:ring-blue-500 focus:border-blue-500 w-full sm:w-auto"
                />
            </div>
        )}
      </div>

      <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
            <input
                type="file"
                id="imageUpload"
                className="hidden"
                accept="image/*"
                onChange={onImageChange}
            />
            <Button
                variant="secondary"
                onClick={() => document.getElementById('imageUpload')?.click()}
            >
                <PhotoIcon className="w-5 h-5 ml-2" />
                أضف صورة
            </Button>
            <Button variant="secondary" onClick={onSaveDraft} disabled={!postText.trim() && !imagePreview}>
              حفظ كمسودة
            </Button>
        </div>
        
        <Button onClick={onPublish} isLoading={isPublishing} disabled={!postText.trim()}>
          {isPublishing ? 'جاري العمل...' : (isScheduled ? 'جدولة الآن' : 'انشر الآن')}
        </Button>
      </div>
    </div>
  );
};

export default PostComposer;
