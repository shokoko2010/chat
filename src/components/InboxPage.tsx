import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { InboxItem, AutoResponderSettings, InboxMessage } from '../types';
import Button from './ui/Button';
import SparklesIcon from './icons/SparklesIcon';
import InboxArrowDownIcon from './icons/InboxArrowDownIcon';
import ChatBubbleOvalLeftEllipsisIcon from './icons/ChatBubbleOvalLeftEllipsisIcon';
import ChatBubbleLeftEllipsisIcon from './icons/ChatBubbleLeftEllipsisIcon'; // For messages
import CheckBadgeIcon from './icons/CheckBadgeIcon';
import AutoResponderSettingsModal from './AutoResponderSettingsModal';
import { GoogleGenAI } from '@google/genai';

interface InboxPageProps {
  items: InboxItem[];
  isLoading: boolean;
  onReply: (item: InboxItem, message: string) => Promise<boolean>;
  onMarkAsDone: (itemId: string) => void;
  onGenerateSmartReplies: (commentText: string) => Promise<string[]>;
  onFetchMessageHistory: (conversationId: string) => void;
  autoResponderSettings: AutoResponderSettings;
  onAutoResponderSettingsChange: (settings: AutoResponderSettings) => void;
  onSync: () => Promise<void>;
  isSyncing: boolean;
  aiClient: GoogleGenAI | null;
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
    return `منذ بضع ثوانٍ`;
}

const FilterButton: React.FC<{label: string, active: boolean, onClick: () => void}> = ({ label, active, onClick }) => (
    <button onClick={onClick} className={`px-4 py-2 rounded-md text-sm font-semibold transition-colors ${active ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600'}`}>
      {label}
    </button>
);

const InboxPage: React.FC<InboxPageProps> = ({
  items,
  isLoading,
  onReply,
  onMarkAsDone,
  onGenerateSmartReplies,
  onFetchMessageHistory,
  autoResponderSettings,
  onAutoResponderSettingsChange,
  onSync,
  isSyncing,
  aiClient,
}) => {
  const [selectedItem, setSelectedItem] = useState<InboxItem | null>(null);
  const [replyText, setReplyText] = useState('');
  const [isReplying, setIsReplying] = useState(false);
  const [smartReplies, setSmartReplies] = useState<string[]>([]);
  const [isGeneratingReplies, setIsGeneratingReplies] = useState(false);
  const [viewFilter, setViewFilter] = useState<'all' | 'messages' | 'comments'>('all');
  const [visibleCount, setVisibleCount] = useState(30);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  const filteredItems = useMemo(() => {
    if (viewFilter === 'all') return items;
    const typeFilter = viewFilter === 'messages' ? 'message' : 'comment';
    return items.filter(i => i.type === typeFilter);
  }, [items, viewFilter]);

  const visibleItems = useMemo(() => filteredItems.slice(0, visibleCount), [filteredItems, visibleCount]);
  const hasMore = visibleCount < filteredItems.length;

  useEffect(() => {
    setVisibleCount(30); // Reset count when filter changes
  }, [viewFilter]);

  const observer = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useCallback((node: HTMLElement | null) => {
    if (isLoading) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0]?.isIntersecting && hasMore) {
        setVisibleCount(prev => prev + 20); // Load next 20 items
      }
    });
    if (node) observer.current.observe(node);
  }, [isLoading, hasMore]);


  useEffect(() => {
    const currentSelectionIsValid = selectedItem && filteredItems.some(item => item.id === selectedItem.id);
    if (!currentSelectionIsValid) {
      const newSelectedItem = filteredItems.length > 0 ? filteredItems[0] : null;
      setSelectedItem(newSelectedItem);
      if (newSelectedItem?.type === 'message' && !newSelectedItem.messages && newSelectedItem.conversationId) {
        onFetchMessageHistory(newSelectedItem.conversationId);
      }
    }
  }, [filteredItems, onFetchMessageHistory, selectedItem]);


  const handleItemSelect = (item: InboxItem) => {
    setSelectedItem(item);
    setReplyText('');
    setSmartReplies([]);
    if (item.type === 'message' && !item.messages && item.conversationId) {
      onFetchMessageHistory(item.conversationId);
    }
  };

  const handleReplySubmit = async () => {
    if (!replyText.trim() || !selectedItem) return;
    setIsReplying(true);
    const success = await onReply(selectedItem, replyText);
    if(success) {
        setReplyText('');
        setSmartReplies([]);
        if (selectedItem.type === 'message' && selectedItem.conversationId) {
          onFetchMessageHistory(selectedItem.conversationId);
        }
    }
    setIsReplying(false);
  };

  const handleSmartReplyClick = async () => {
    if(!selectedItem || !aiClient) return;
    setIsGeneratingReplies(true);
    try {
      const replies = await onGenerateSmartReplies(selectedItem.text);
      setSmartReplies(replies);
    } catch(e) {
        console.error("Failed to generate smart replies:", e);
    } finally {
      setIsGeneratingReplies(false);
    }
  };
  
  const handleMarkAsDoneClick = () => {
      if (!selectedItem) return;
      onMarkAsDone(selectedItem.id);
  }

  const handleSaveSettings = (newSettings: AutoResponderSettings) => {
    onAutoResponderSettingsChange(newSettings);
    setIsSettingsModalOpen(false);
  };
  
  const renderList = () => {
    if (isLoading && items.length === 0) return <div className="p-4 text-center text-gray-500">جاري تحميل البريد الوارد...</div>;
    if (filteredItems.length === 0 && !isLoading) return <div className="p-4 text-center text-gray-500">لا يوجد شيء لعرضه.</div>;

    return (
        <>
            {visibleItems.map(item => {
                const Icon = item.type === 'message' ? ChatBubbleLeftEllipsisIcon : ChatBubbleOvalLeftEllipsisIcon;
                return (
                    <button key={item.id} onClick={() => handleItemSelect(item)} className={`w-full text-right p-3 border-b dark:border-gray-700 flex items-start gap-3 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors ${selectedItem?.id === item.id ? 'bg-blue-100 dark:bg-blue-900/40' : 'bg-white dark:bg-gray-800'}`}>
                        {!item.isReplied && <span className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0" title="غير مقروء"></span>}
                        <div className={`relative flex-shrink-0 ${item.isReplied ? 'ml-[10px]' : ''}`}>
                            <img src={item.authorPictureUrl} alt={item.authorName} className="w-10 h-10 rounded-full" />
                            <Icon className={`absolute -bottom-1 -right-1 w-5 h-5 bg-white dark:bg-gray-700 rounded-full p-0.5 ${item.type === 'message' ? 'text-blue-500' : 'text-gray-500'}`} />
                        </div>
                        <div className="flex-grow overflow-hidden">
                            <div className="flex justify-between items-baseline">
                                <p className="font-bold text-gray-800 dark:text-white truncate">{item.authorName}</p>
                                <p className="text-xs text-gray-400 flex-shrink-0">{timeSince(item.timestamp)}</p>
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-300 truncate">{item.text}</p>
                        </div>
                    </button>
                )
            })}
            <div ref={loadMoreRef} className="h-10 flex items-center justify-center">
                {hasMore && !isLoading && (
                    <div className="flex items-center gap-2 text-gray-500">
                         <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>جاري تحميل المزيد...</span>
                    </div>
                )}
            </div>
        </>
    );
  }
  
  const renderDetail = () => {
    if(!selectedItem) return <div className="p-8 text-center text-gray-500 flex flex-col items-center justify-center h-full bg-gray-50 dark:bg-gray-800/50"><InboxArrowDownIcon className="w-16 h-16 mb-4 text-gray-400" /><p>اختر محادثة من القائمة لعرضها.</p></div>;

    const renderReplyArea = () => (
      <div className="mt-auto pt-4 border-t dark:border-gray-700 space-y-3 bg-white dark:bg-gray-800 p-4">
          {smartReplies.length > 0 && (
            <div className="flex flex-wrap gap-2">
                {smartReplies.map((reply, i) => (
                    <button 
                        key={i} 
                        onClick={() => setReplyText(reply)} 
                        className="px-3 py-1 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/50 dark:hover:bg-blue-900 rounded-full text-sm text-blue-800 dark:text-blue-200 transition-colors"
                    >
                        {reply}
                    </button>
                ))}
            </div>
           )}
          <textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="اكتب ردك هنا..." className="w-full h-24 p-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-gray-50 dark:bg-gray-700"/>
          <div className="flex justify-between items-center flex-wrap gap-2">
              <div className="flex items-center gap-2">
                  <Button onClick={handleSmartReplyClick} isLoading={isGeneratingReplies} variant="secondary" disabled={!aiClient || isGeneratingReplies}>
                      <SparklesIcon className="w-5 h-5 ml-2" /> اقتراح ردود
                  </Button>
                  {!selectedItem.isReplied &&
                    <Button onClick={handleMarkAsDoneClick} variant="secondary">
                        <CheckBadgeIcon className="w-5 h-5 ml-2" /> تمييز كمكتمل
                    </Button>
                  }
              </div>
              <Button onClick={handleReplySubmit} isLoading={isReplying} disabled={!replyText.trim()}>{isReplying ? 'جاري الإرسال...' : 'إرسال الرد'}</Button>
          </div>
      </div>
    );

    if (selectedItem.type === 'message') {
      return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-800/50">
            <div className="p-4 border-b dark:border-gray-700 flex items-center gap-3 bg-white dark:bg-gray-800 flex-shrink-0">
              <img src={selectedItem.authorPictureUrl} alt={selectedItem.authorName} className="w-10 h-10 rounded-full" />
              <p className="font-bold text-gray-900 dark:text-white">{selectedItem.authorName}</p>
            </div>
            
            <div className="flex-grow overflow-y-auto p-4 space-y-4">
              {!selectedItem.messages ? <p className="text-center text-gray-500">جاري تحميل المحادثة...</p> : 
                selectedItem.messages.map((msg: InboxMessage) => (
                    <div key={msg.id} className={`flex items-end gap-2 ${msg.from.id !== selectedItem.authorId ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-md p-3 rounded-2xl ${msg.from.id !== selectedItem.authorId ? 'bg-blue-600 text-white rounded-br-none' : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-bl-none'}`}>
                        <p className="whitespace-pre-wrap break-words">{msg.message}</p>
                      </div>
                    </div>
                ))
              }
            </div>
            {renderReplyArea()}
        </div>
      );
    }
    
    // Fallback for Comments
    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-800/50">
            <div className="p-4 border-b dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0">
                <div className="flex items-center gap-3 mb-3">
                    <img src={selectedItem.authorPictureUrl} alt={selectedItem.authorName} className="w-10 h-10 rounded-full" />
                    <div>
                        <p className="font-bold text-gray-900 dark:text-white">{selectedItem.authorName}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{new Date(selectedItem.timestamp).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                    </div>
                </div>
                <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap text-lg">{selectedItem.text}</p>
            </div>
            
            <div className="flex-grow overflow-y-auto p-4">
              {selectedItem.post && <div className="text-sm"><p className="font-semibold text-gray-500 dark:text-gray-400 mb-2">في الرد على المنشور:</p><div className="p-3 bg-white dark:bg-gray-800 rounded-lg flex items-center gap-3 shadow-sm">{selectedItem.post.picture && <img src={selectedItem.post.picture} alt="Post thumbnail" className="w-12 h-12 rounded-md object-cover flex-shrink-0" />}<p className="text-gray-700 dark:text-gray-300 line-clamp-2">{selectedItem.post.message || "منشور بصورة فقط"}</p></div></div>}
            </div>
            {renderReplyArea()}
        </div>
    )
  }
  
  return (
    <>
    <div className="flex flex-col lg:flex-row h-full max-h-[calc(100vh-200px)] bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
        <div className="w-full lg:w-[380px] border-r dark:border-gray-700 flex flex-col flex-shrink-0">
          <div className="p-3 border-b dark:border-gray-700 flex-shrink-0">
             <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <FilterButton label="الكل" active={viewFilter === 'all'} onClick={() => setViewFilter('all')} />
                    <FilterButton label="الرسائل" active={viewFilter === 'messages'} onClick={() => setViewFilter('messages')} />
                    <FilterButton label="التعليقات" active={viewFilter === 'comments'} onClick={() => setViewFilter('comments')} />
                </div>
                 <div className="flex items-center gap-2">
                    <Button onClick={onSync} isLoading={isSyncing} disabled={isSyncing} variant="secondary" className="!p-2" title="تحديث البريد الوارد">
                      <svg className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0011.667 0l3.181-3.183m-11.667-11.667l3.181 3.183a8.25 8.25 0 010 11.667l-3.181 3.183" /></svg>
                    </Button>
                </div>
            </div>
          </div>
          <div className="overflow-y-auto">
            {renderList()}
          </div>
           <div className="mt-auto p-3 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex-shrink-0">
              <Button variant="secondary" onClick={() => setIsSettingsModalOpen(true)} className="w-full">
                إعدادات الرد التلقائي
              </Button>
           </div>
        </div>
        <div className="w-full lg:w-2/3 flex flex-col">
          {renderDetail()}
        </div>
    </div>
    <AutoResponderSettingsModal
      isOpen={isSettingsModalOpen}
      onClose={() => setIsSettingsModalOpen(false)}
      initialSettings={autoResponderSettings}
      onSave={handleSaveSettings}
      aiClient={aiClient}
    />
    </>
  );
};

export default InboxPage;