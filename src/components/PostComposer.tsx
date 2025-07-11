import React, { useState } from 'react';
import Button from './ui/Button';
import PhotoIcon from './icons/PhotoIcon';
import SparklesIcon from './icons/SparklesIcon';
import WandSparklesIcon from './icons/WandSparklesIcon';
import { generatePostSuggestion, generateImageFromPrompt, getBestPostingTime, generateHashtags, generateImageWithStabilityAI } from '../services/geminiService';
import { GoogleGenAI } from '@google/genai';
import { Target, PageProfile } from '../types';
import InstagramIcon from './icons/InstagramIcon';
import HashtagIcon from './icons/HashtagIcon';
import { CanvaButton } from '@canva/button';
import CanvaIcon from './icons/CanvaIcon';


interface PostComposerProps {
  onPublish: () => Promise<void>;
  onSaveDraft: () => void;
  isPublishing: boolean;
  postText: string;
  onPostTextChange: (text: string) => void;
  onImageChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onImageGenerated: (file: File) => void;
  onImageRemove: () => void;
  imagePreview: string | null;
  selectedImage: File | null;
  isScheduled: boolean;
  onIsScheduledChange: (checked: boolean) => void;
  scheduleDate: string;
  onScheduleDateChange: (date: string) => void;
  error: string;
  aiClient: GoogleGenAI | null;
  stabilityApiKey: string | null;
  canvaApiKey: string | null;
  managedTarget: Target;
  linkedInstagramTarget: Target | null;
  includeInstagram: boolean;
  onIncludeInstagramChange: (checked: boolean) => void;
  pageProfile: PageProfile;
}


const base64ToFile = (base64: string, filename: string): File => {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: 'image/jpeg' });
  return new File([blob], filename, { type: 'image/jpeg' });
}

const formatDateTimeForInput = (date: Date) => {
    const pad = (num: number) => num.toString().padStart(2, '0');
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const PostComposer: React.FC<PostComposerProps> = ({
  onPublish,
  onSaveDraft,
  isPublishing,
  postText,
  onPostTextChange,
  onImageChange,
  onImageGenerated,
  onImageRemove,
  imagePreview,
  selectedImage,
  isScheduled,
  onIsScheduledChange,
  scheduleDate,
  onScheduleDateChange,
  error,
  aiClient,
  stabilityApiKey,
  canvaApiKey,
  managedTarget,
  linkedInstagramTarget,
  includeInstagram,
  onIncludeInstagramChange,
  pageProfile,
}) => {
  const [aiTopic, setAiTopic] = useState('');
  const [isGeneratingText, setIsGeneratingText] = useState(false);
  const [aiTextError, setAiTextError] = useState('');
  
  const [imageService, setImageService] = useState<'gemini' | 'stability'>('gemini');
  const [aiImagePrompt, setAiImagePrompt] = useState('');
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [aiImageError, setAiImageError] = useState('');

  const [isSuggestingTime, setIsSuggestingTime] = useState(false);
  const [aiTimeError, setAiTimeError] = useState('');
  const [isGeneratingHashtags, setIsGeneratingHashtags] = useState(false);
  const [aiHashtagError, setAiHashtagError] = useState('');
  
  const handleGenerateTextWithAI = async () => {
      if (!aiClient) return;
      if (!aiTopic.trim()) {
          setAiTextError('يرجى إدخال موضوع لتوليد منشور عنه.');
          return;
      }
      setAiTextError('');
      setIsGeneratingText(true);
      try {
        const suggestion = await generatePostSuggestion(aiClient, aiTopic, pageProfile);
        onPostTextChange(suggestion);
      } catch (e: any) {
        setAiTextError(e.message || 'حدث خطأ غير متوقع أثناء توليد النص.');
      } finally {
        setIsGeneratingText(false);
      }
  };

  const handleGenerateImageWithAI = async () => {
    if (!aiImagePrompt.trim()) {
      setAiImageError('يرجى إدخال وصف لإنشاء الصورة.');
      return;
    }
    setAiImageError('');
    setIsGeneratingImage(true);
    
    try {
      let base64Bytes: string;
      if (imageService === 'stability') {
        if (!stabilityApiKey) throw new Error("مفتاح Stability AI API غير مكوّن. يرجى إضافته في الإعدادات.");
        base64Bytes = await generateImageWithStabilityAI(stabilityApiKey, aiImagePrompt, aiClient);
      } else { // 'gemini'
        if (!aiClient) throw new Error("مفتاح Gemini API غير مكوّن. يرجى إضافته في الإعدادات.");
        base64Bytes = await generateImageFromPrompt(aiClient, aiImagePrompt);
      }
      const imageFile = base64ToFile(base64Bytes, `${aiImagePrompt.substring(0, 20).replace(/\s/g, '_')}.jpeg`);
      onImageGenerated(imageFile);
    } catch (e: any) {
      setAiImageError(e.message || 'حدث خطأ غير متوقع. يرجى التأكد من أن وصفك لا ينتهك سياسات المحتوى.');
    } finally {
      setIsGeneratingImage(false);
    }
  };
  
  const handleSuggestTimeWithAI = async () => {
    if (!aiClient) return;
    if (!postText.trim()) {
        setAiTimeError('اكتب نص المنشور أولاً لاقتراح وقت.');
        return;
    }
    setAiTimeError('');
    setIsSuggestingTime(true);
    try {
        const suggestedDate = await getBestPostingTime(aiClient, postText);
        onScheduleDateChange(formatDateTimeForInput(suggestedDate));
        onIsScheduledChange(true);
    } catch (e: any) {
        setAiTimeError(e.message || 'حدث خطأ غير متوقع. قد تكون استجابة الذكاء الاصطناعي غير صالحة.');
    } finally {
        setIsSuggestingTime(false);
    }
  };

  const handleGenerateHashtags = async () => {
    if (!aiClient) return;
    if (!postText.trim() && !selectedImage) {
        setAiHashtagError('اكتب نصًا أو أضف صورة أولاً لاقتراح هاشتاجات.');
        return;
    }
    setAiHashtagError('');
    setIsGeneratingHashtags(true);
    try {
        const hashtags = await generateHashtags(aiClient, postText, pageProfile, selectedImage ?? undefined);
        const hashtagString = hashtags.join(' ');
        onPostTextChange(postText ? `${postText}\n\n${hashtagString}` : hashtagString);
    } catch (e: any) {
        setAiHashtagError(e.message || 'حدث خطأ غير متوقع.');
    } finally {
        setIsGeneratingHashtags(false);
    }
  };
  
  const handleCanvaPublish = async (result: any) => {
    let exportUrl: string | null = null;

    if ('exportUrl' in result && typeof result.exportUrl === 'string') {
        exportUrl = result.exportUrl;
    } else if ('designs' in result && Array.isArray(result.designs) && result.designs.length > 0) {
        exportUrl = result.designs[0].exportUrl; // Take the first one for single composer
    }

    if (!exportUrl) {
        setAiImageError(`خطأ في معالجة تصميم Canva: لم يتم العثور على رابط للتصميم.`);
        return;
    }

    setIsGeneratingImage(true); // Reuse loading state for user feedback
    setAiImageError('');
    try {
        const response = await fetch(exportUrl);
        if (!response.ok) {
            throw new Error(`فشل جلب الصورة من Canva. الحالة: ${response.status}`);
        }
        const blob = await response.blob();
        const file = new File([blob], "canva-design.jpeg", { type: "image/jpeg" });
        onImageGenerated(file);
    } catch (e: any) {
        setAiImageError(`خطأ في معالجة تصميم Canva: ${e.message}`);
    } finally {
        setIsGeneratingImage(false);
    }
  };

  const aiHelperText = !aiClient ? (
    <p className="text-yellow-600 dark:text-yellow-400 text-sm mt-2">
      ميزات الذكاء الاصطناعي معطلة. يرجى إدخال مفتاح Gemini API في الإعدادات لتفعيلها.
    </p>
  ) : null;
  
  const getPublishButtonText = () => {
    if (isPublishing) return 'جاري العمل...';
    if (isScheduled) {
        return includeInstagram ? 'حفظ كتذكير' : 'جدولة الآن';
    }
    return 'انشر الآن';
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg space-y-6">
      <h2 className="text-2xl font-bold text-gray-800 dark:text-white">إنشاء منشور جديد</h2>
      
      <div className="p-4 border border-blue-200 dark:border-blue-900 rounded-lg bg-blue-50 dark:bg-gray-700/50">
          <label htmlFor="ai-topic" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            مساعد النصوص بالذكاء الاصطناعي ✨
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input id="ai-topic" type="text" value={aiTopic} onChange={(e) => setAiTopic(e.target.value)} placeholder="اكتب فكرة للمنشور، مثلاً: إطلاق منتج جديد" className="flex-grow p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 focus:ring-blue-500 focus:border-blue-500" disabled={isGeneratingText || !aiClient}/>
            <Button onClick={handleGenerateTextWithAI} isLoading={isGeneratingText} disabled={!aiClient}><SparklesIcon className="w-5 h-5 ml-2"/>{isGeneratingText ? 'جاري التوليد...' : 'ولّد لي نصاً'}</Button>
          </div>
          {aiTextError && <p className="text-red-500 text-sm mt-2">{aiTextError}</p>}
          {aiHelperText}
      </div>

      <textarea value={postText} onChange={(e) => onPostTextChange(e.target.value)} placeholder="بماذا تفكر؟ اكتب منشورك هنا..." className="w-full h-48 p-3 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white transition" />
        
        {/* New Hashtag Generator */}
        <div className="flex flex-col sm:flex-row gap-2">
            <Button 
                onClick={handleGenerateHashtags} 
                isLoading={isGeneratingHashtags} 
                disabled={!aiClient || (!postText.trim() && !selectedImage)}
                variant="secondary"
                className="w-full sm:w-auto"
            >
                <HashtagIcon className="w-5 h-5 ml-2"/>
                {isGeneratingHashtags ? 'جاري...' : 'اقترح هاشتاجات'}
            </Button>
        </div>
        {aiHashtagError && <p className="text-red-500 text-sm">{aiHashtagError}</p>}


      {imagePreview && (
        <div className="relative w-40">
          <img src={imagePreview} alt="Preview" className="rounded-lg w-full h-auto" />
          <button onClick={onImageRemove} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 leading-none w-6 h-6 flex items-center justify-center text-lg" aria-label="Remove image">&times;</button>
        </div>
      )}
      
      {includeInstagram && !imagePreview && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-md text-sm">
          <b>ملاحظة:</b> منشورات انستجرام تتطلب وجود صورة. يرجى إضافة صورة للمتابعة.
        </div>
      )}
      
      <div className="p-4 border border-purple-200 dark:border-purple-900 rounded-lg bg-purple-50 dark:bg-gray-700/50 space-y-3">
          <label htmlFor="ai-image-prompt" className="block text-sm font-medium text-gray-700 dark:text-gray-300">مولّد الصور بالذكاء الاصطناعي 🤖</label>
          <div className="flex bg-gray-200 dark:bg-gray-600 rounded-lg p-1 max-w-xs">
              <button onClick={() => setImageService('gemini')} disabled={!aiClient} className={`w-1/2 p-2 rounded-md text-sm font-semibold transition-colors ${imageService === 'gemini' ? 'bg-white dark:bg-gray-900 shadow text-purple-600' : 'text-gray-600 dark:text-gray-300'} disabled:opacity-50 disabled:cursor-not-allowed`}>
                  Gemini
              </button>
              <button onClick={() => setImageService('stability')} disabled={!stabilityApiKey} className={`w-1/2 p-2 rounded-md text-sm font-semibold transition-colors ${imageService === 'stability' ? 'bg-white dark:bg-gray-900 shadow text-purple-600' : 'text-gray-600 dark:text-gray-300'} disabled:opacity-50 disabled:cursor-not-allowed`}>
                  Stability AI
              </button>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <input id="ai-image-prompt" type="text" value={aiImagePrompt} onChange={(e) => setAiImagePrompt(e.target.value)} placeholder="وصف الصورة، مثلاً: رائد فضاء يقرأ على المريخ" className="flex-grow p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 focus:ring-purple-500 focus:border-purple-500" disabled={isGeneratingImage || (!aiClient && !stabilityApiKey)}/>
            <Button
              onClick={handleGenerateImageWithAI}
              isLoading={isGeneratingImage}
              className="bg-purple-600 hover:bg-purple-700 focus:ring-purple-500"
              disabled={isGeneratingImage || (imageService === 'gemini' && !aiClient) || (imageService === 'stability' && (!stabilityApiKey || !aiClient))}
              title={imageService === 'stability' && !aiClient ? "يتطلب مفتاح Stability AI ومفتاح Gemini للترجمة" : ""}
            >
                <PhotoIcon className="w-5 h-5 ml-2"/>{isGeneratingImage ? 'جاري الإنشاء...' : 'إنشاء صورة'}
            </Button>
          </div>
          {aiImageError && <p className="text-red-500 text-sm mt-2">{aiImageError}</p>}
          {(imageService === 'gemini' && !aiClient) && <p className="text-yellow-600 dark:text-yellow-400 text-sm mt-2">يرجى إضافة مفتاح Gemini API في الإعدادات.</p>}
          {(imageService === 'stability' && !stabilityApiKey) && <p className="text-yellow-600 dark:text-yellow-400 text-sm mt-2">يرجى إضافة مفتاح Stability AI API في الإعدادات.</p>}
          {(imageService === 'stability' && stabilityApiKey && !aiClient) && <p className="text-yellow-600 dark:text-yellow-400 text-sm mt-2">تتطلب الترجمة التلقائية للغة العربية مفتاح Gemini API.</p>}
      </div>
      
      {error && <p className="text-red-500 text-sm mt-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-md">{error}</p>}
      
      {managedTarget.type === 'page' && <div className="p-4 border rounded-lg dark:border-gray-700">
        <div className="flex items-center">
            <input id="include-ig-checkbox" type="checkbox" checked={includeInstagram} onChange={e => onIncludeInstagramChange(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer" disabled={!linkedInstagramTarget} />
            <label htmlFor="include-ig-checkbox" className="mr-2 text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1"><InstagramIcon className="w-4 h-4"/> النشر على انستجرام أيضاً</label>
        </div>
        {!linkedInstagramTarget && <p className="text-xs text-gray-400 mt-1">لم يتم العثور على حساب انستجرام مرتبط بهذه الصفحة.</p>}
      </div>}
      
      <div className="p-4 border rounded-lg dark:border-gray-700">
        <div className="flex items-center">
            <input id="schedule-checkbox" type="checkbox" checked={isScheduled} onChange={e => onIsScheduledChange(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"/>
            <label htmlFor="schedule-checkbox" className="mr-2 text-sm font-medium text-gray-700 dark:text-gray-300">{includeInstagram ? 'جدولة كتذكير' : 'جدولة المنشور'}</label>
        </div>
        {includeInstagram && isScheduled && <p className="text-yellow-600 dark:text-yellow-400 text-sm mt-2"><b>ملاحظة:</b> سيتم جدولة المنشور على فيسبوك وحفظ تذكير للنشر على انستجرام.</p>}
        {isScheduled && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
                <input type="datetime-local" value={scheduleDate} onChange={e => onScheduleDateChange(e.target.value)} className="p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 focus:ring-blue-500 focus:border-blue-500"/>
                 <Button variant="secondary" onClick={handleSuggestTimeWithAI} isLoading={isSuggestingTime} disabled={!postText.trim() || !aiClient}><WandSparklesIcon className="w-5 h-5 ml-2"/>اقترح أفضل وقت</Button>
            </div>
        )}
        {aiTimeError && <p className="text-red-500 text-sm mt-2">{aiTimeError}</p>}
        {isScheduled && aiHelperText}
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-wrap">
            <input type="file" id="imageUpload" className="hidden" accept="image/*" onChange={onImageChange}/>
            <Button variant="secondary" onClick={() => document.getElementById('imageUpload')?.click()}><PhotoIcon className="w-5 h-5 ml-2" />أضف صورة</Button>
            
            {canvaApiKey ? (
                <CanvaButton
                    apiKey={canvaApiKey}
                    designType={'SocialMedia'}
                    onPublish={handleCanvaPublish}
                >
                    {({ launch, isLoading: isCanvaLoading }) => (
                        <Button
                            variant="secondary"
                            onClick={launch}
                            isLoading={isCanvaLoading || isGeneratingImage}
                            className="bg-[#00c4cc] hover:bg-[#00a2aa] text-white"
                        >
                            <CanvaIcon className="w-5 h-5 ml-2" />
                            صمم بـ Canva
                        </Button>
                    )}
                </CanvaButton>
            ) : (
                <Button variant="secondary" disabled title="أضف مفتاح Canva API في الإعدادات" className="bg-[#00c4cc] hover:bg-[#00a2aa] text-white">
                    <CanvaIcon className="w-5 h-5 ml-2" />
                    صمم بـ Canva
                </Button>
            )}
        </div>
        <div className="flex items-center gap-2">
             <Button variant="secondary" onClick={onSaveDraft} disabled={isPublishing || (!postText.trim() && !imagePreview)}>حفظ كمسودة</Button>
            <Button onClick={onPublish} isLoading={isPublishing} disabled={(!postText.trim() && !imagePreview) || (includeInstagram && !imagePreview)}>{getPublishButtonText()}</Button>
        </div>
      </div>
    </div>
  );
};

export default PostComposer;