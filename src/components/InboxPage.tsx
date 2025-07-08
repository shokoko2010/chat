import React, { useState } from 'react';
import { InboxItem, AutoResponderSettings } from '../types';
import Button from './ui/Button';
import SparklesIcon from './icons/SparklesIcon';
import InboxArrowDownIcon from './icons/InboxArrowDownIcon';

interface InboxPageProps {
  items: InboxItem[];
  isLoading: boolean;
  onReply: (commentId: string, message: string) => Promise<boolean>;
  onGenerateSmartReplies: (commentText: string) => Promise<string[]>;
  autoResponderSettings: AutoResponderSettings;
  onAutoResponderSettingsChange: (settings: AutoResponderSettings) => void;
  isSimMode: boolean;
}

const timeSince = (dateString: string) => {
    const date = new Date(dateString);
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return `منذ ${Math.floor(interval)} سنة`;
    interval = seconds / 2592000;
    if (interval > 1) return `منذ ${Math.floor(interval)} شهر`;
    interval = seconds / 86400;
    if (interval > 1) return `منذ ${Math.floor(interval)} يوم`;
    interval = seconds / 3600;
    if (interval > 1) return `منذ ${Math.floor(interval)} ساعة`;
    interval = seconds / 60;
    if (interval > 1) return `منذ ${Math.floor(interval)} دقيقة`;
    return `منذ ${Math.floor(seconds)} ثانية`;
}

const InboxPage: React.FC<InboxPageProps> = ({
  items,
  isLoading,
  onReply,
  onGenerateSmartReplies,
  autoResponderSettings,
  onAutoResponderSettingsChange,
  isSimMode,
}) => {
  const [selectedItem, setSelectedItem] = useState<InboxItem | null>(items[0] || null);
  const [replyText, setReplyText] = useState('');
  const [isReplying, setIsReplying] = useState(false);
  const [smartReplies, setSmartReplies] = useState<string[]>([]);
  const [isGeneratingReplies, setIsGeneratingReplies] = useState(false);

  React.useEffect(() => {
    if(!selectedItem && items.length > 0) {
        setSelectedItem(items[0]);
    }
  }, [items, selectedItem]);

  const handleItemSelect = (item: InboxItem) => {
    setSelectedItem(item);
    setReplyText('');
    setSmartReplies([]);
  };

  const handleReplySubmit = async () => {
    if (!replyText.trim() || !selectedItem) return;
    setIsReplying(true);
    const success = await onReply(selectedItem.id, replyText);
    if(success) {
        setReplyText('');
        // Optionally, refetch or update the UI to show the reply
    }
    setIsReplying(false);
  };

  const handleSmartReplyClick = async () => {
    if(!selectedItem) return;
    setIsGeneratingReplies(true);
    const replies = await onGenerateSmartReplies(selectedItem.text);
    setSmartReplies(replies);
    setIsGeneratingReplies(false);
  };
  
  const renderList = () => {
    if(isLoading) return <div className="p-4 text-center text-gray-500">جاري تحميل التعليقات...</div>;
    if(items.length === 0) return <div className="p-4 text-center text-gray-500">لا توجد تعليقات لعرضها.</div>;
    return items.map(item => (
        <button key={item.id} onClick={() => handleItemSelect(item)} className={`w-full text-right p-3 border-b dark:border-gray-700 flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors ${selectedItem?.id === item.id ? 'bg-blue-50 dark:bg-gray-700' : ''}`}>
            <img src={item.authorPictureUrl} alt={item.authorName} className="w-10 h-10 rounded-full flex-shrink-0" />
            <div className="flex-grow overflow-hidden">
                <div className="flex justify-between items-baseline">
                    <p className="font-bold text-gray-800 dark:text-white truncate">{item.authorName}</p>
                    <p className="text-xs text-gray-400 flex-shrink-0">{timeSince(item.timestamp)}</p>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300 truncate">{item.text}</p>
            </div>
        </button>
    ));
  }
  
  const renderDetail = () => {
    if(!selectedItem) return <div className="p-8 text-center text-gray-500 flex flex-col items-center justify-center h-full"><InboxArrowDownIcon className="w-16 h-16 mb-4 text-gray-400" /><p>اختر تعليقًا من القائمة لعرض التفاصيل والرد عليه.</p></div>;

    return (
        <div className="p-6 flex flex-col h-full">
            <div className="pb-4 border-b dark:border-gray-700">
                <div className="flex items-center gap-3 mb-3">
                    <img src={selectedItem.authorPictureUrl} alt={selectedItem.authorName} className="w-10 h-10 rounded-full" />
                    <div>
                        <p className="font-bold text-gray-900 dark:text-white">{selectedItem.authorName}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{new Date(selectedItem.timestamp).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                    </div>
                </div>
                <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{selectedItem.text}</p>
            </div>
            
            <div className="py-4 text-sm">
                <p className="font-semibold text-gray-500 dark:text-gray-400 mb-2">في الرد على المنشور:</p>
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg flex items-center gap-3">
                    {selectedItem.post.picture && <img src={selectedItem.post.picture} alt="Post thumbnail" className="w-12 h-12 rounded-md object-cover flex-shrink-0" />}
                    <p className="text-gray-700 dark:text-gray-300 line-clamp-2">{selectedItem.post.message || "منشور بصورة فقط"}</p>
                </div>
            </div>

            <div className="mt-auto pt-4 border-t dark:border-gray-700 space-y-4">
                <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="اكتب ردك هنا..."
                    className="w-full h-24 p-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700"
                />
                 <div className="flex flex-col sm:flex-row gap-2">
                    <Button onClick={handleSmartReplyClick} isLoading={isGeneratingReplies} variant="secondary" className="flex-grow">
                        <SparklesIcon className="w-5 h-5 ml-2" />
                        اقتراح ردود ذكية
                    </Button>
                    <Button onClick={() => setReplyText(autoResponderSettings.message)} variant="secondary" disabled={!autoResponderSettings.enabled || !autoResponderSettings.message}>
                       استخدام الرد التلقائي
                    </Button>
                </div>

                {smartReplies.length > 0 && (
                    <div className="space-y-2">
                        <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">مقترحات:</p>
                        {smartReplies.map((reply, i) => (
                            <button key={i} onClick={() => setReplyText(reply)} className="w-full text-right p-2 bg-blue-50 hover:bg-blue-100 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-md text-sm text-blue-800 dark:text-blue-200 transition-colors">
                                {reply}
                            </button>
                        ))}
                    </div>
                )}

                <div className="text-left">
                    <Button onClick={handleReplySubmit} isLoading={isReplying} disabled={!replyText.trim()}>
                        {isReplying ? 'جاري الإرسال...' : 'إرسال الرد'}
                    </Button>
                </div>
            </div>
        </div>
    )
  }

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-250px)] bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden fade-in">
        {/* Left column: Inbox List */}
        <div className="w-full lg:w-1/3 border-r dark:border-gray-700 overflow-y-auto">
            {renderList()}
        </div>
        {/* Right column: Detail view & Auto-responder settings */}
        <div className="w-full lg:w-2/3 flex flex-col">
            <div className="flex-grow overflow-y-auto">
              {renderDetail()}
            </div>
             {/* Auto-responder settings */}
            <div className="p-4 bg-gray-50 dark:bg-gray-900/50 border-t dark:border-gray-700 flex-shrink-0">
                <h4 className="font-bold text-gray-800 dark:text-white mb-2">إعدادات الرد التلقائي على التعليقات</h4>
                <div className="flex items-center gap-4 mb-2">
                     <label htmlFor="auto-responder-toggle" className="flex items-center cursor-pointer">
                        <div className="relative">
                            <input 
                                type="checkbox" 
                                id="auto-responder-toggle" 
                                className="sr-only" 
                                checked={autoResponderSettings.enabled}
                                onChange={e => onAutoResponderSettingsChange({...autoResponderSettings, enabled: e.target.checked})}
                             />
                            <div className="block bg-gray-600 w-14 h-8 rounded-full"></div>
                            <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition ${autoResponderSettings.enabled ? 'translate-x-6 bg-green-400' : ''}`}></div>
                        </div>
                        <div className="mr-3 text-gray-700 dark:text-gray-300 font-medium">
                           {autoResponderSettings.enabled ? 'مفعّل' : 'غير مفعّل'}
                        </div>
                    </label>
                </div>
                <textarea
                    value={autoResponderSettings.message}
                    onChange={e => onAutoResponderSettingsChange({...autoResponderSettings, message: e.target.value})}
                    placeholder="اكتب رسالة الرد التلقائي هنا... يمكنك استخدام {user_name} ليتم استبداله باسم صاحب التعليق."
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    rows={2}
                    disabled={!autoResponderSettings.enabled}
                />
                 <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">ملاحظة: هذه الميزة تعمل حاليًا كمساعد للرد السريع عبر زر "استخدام الرد التلقائي" أعلاه.</p>
            </div>
        </div>
    </div>
  );
};

export default InboxPage;