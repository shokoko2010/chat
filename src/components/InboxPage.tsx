
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { InboxItem, AutoResponderSettings, InboxMessage } from '../types';
import Button from './ui/Button';
import SparklesIcon from './icons/SparklesIcon';
import InboxArrowDownIcon from './icons/InboxArrowDownIcon';
import ChatBubbleOvalLeftEllipsisIcon from './icons/ChatBubbleOvalLeftEllipsisIcon';
import ChatBubbleLeftEllipsisIcon from './icons/ChatBubbleLeftEllipsisIcon'; // For messages

interface InboxPageProps {
  items: InboxItem[];
  isLoading: boolean;
  onReply: (item: InboxItem, message: string) => Promise<boolean>;
  onGenerateSmartReplies: (commentText: string) => Promise<string[]>;
  onFetchMessageHistory: (conversationId: string) => void;
  autoResponderSettings: AutoResponderSettings;
  onAutoResponderSettingsChange: (settings: AutoResponderSettings) => void;
  onSync: () => Promise<void>;
  isSyncing: boolean;
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

const FilterButton: React.FC<{label: string, active: boolean, onClick: () => void}> = ({ label, active, onClick }) => (
    <button onClick={onClick} className={`px-4 py-2 rounded-md text-sm font-semibold transition-colors ${active ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600'}`}>
      {label}
    </button>
);


const InboxPage: React.FC<InboxPageProps> = ({
  items,
  isLoading,
  onReply,
  onGenerateSmartReplies,
  onFetchMessageHistory,
  autoResponderSettings,
  onAutoResponderSettingsChange,
  onSync,
  isSyncing,
}) => {
  const [selectedItem, setSelectedItem] = useState<InboxItem | null>(null);
  const [replyText, setReplyText] = useState('');
  const [isReplying, setIsReplying] = useState(false);
  const [smartReplies, setSmartReplies] = useState<string[]>([]);
  const [isGeneratingReplies, setIsGeneratingReplies] = useState(false);
  const [viewFilter, setViewFilter] = useState<'all' | 'messages' | 'comments'>('all');
  const [visibleCount, setVisibleCount] = useState(30);

  const filteredItems = React.useMemo(() => {
    if (viewFilter === 'all') return items;
    if (viewFilter === 'messages') return items.filter(i => i.type === 'message');
    if (viewFilter === 'comments') return items.filter(i => i.type === 'comment');
    return [];
  }, [items, viewFilter]);

  const visibleItems = useMemo(() => filteredItems.slice(0, visibleCount), [filteredItems, visibleCount]);
  const hasMore = visibleCount < filteredItems.length;

  useEffect(() => {
    setVisibleCount(30);
  }, [viewFilter]);

  const observer = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useCallback(node => {
    if (isLoading) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0] && entries[0].isIntersecting && hasMore) {
        setVisibleCount(prev => prev + 20); // Load next 20 items
      }
    });
    if (node) observer.current.observe(node);
  }, [isLoading, hasMore]);


  useEffect(() => {
    if (!selectedItem || !filteredItems.find(i => i.id === selectedItem.id)) {
      if (visibleItems.length > 0) {
        const itemToSelect = visibleItems[0];
        setSelectedItem(itemToSelect);
        if (itemToSelect.type === 'message' && !itemToSelect.messages) {
            onFetchMessageHistory(itemToSelect.id);
        }
      } else {
        setSelectedItem(null);
      }
    }
  }, [visibleItems, selectedItem, filteredItems, onFetchMessageHistory]);

  const handleItemSelect = (item: InboxItem) => {
    setSelectedItem(item);
    setReplyText('');
    setSmartReplies([]);
    if (item.type === 'message' && !item.messages) {
      onFetchMessageHistory(item.id);
    }
  };

  const handleReplySubmit = async () => {
    if (!replyText.trim() || !selectedItem) return;
    setIsReplying(true);
    const success = await onReply(selectedItem, replyText);
    if(success) {
        setReplyText('');
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

  const handleSettingsChange = <T extends keyof AutoResponderSettings>(
    type: T,
    updates: Partial<AutoResponderSettings[T]>
  ) => {
    onAutoResponderSettingsChange({ 
      ...autoResponderSettings,
      [type]: { ...autoResponderSettings[type], ...updates }
    });
  };
  
  const renderList = () => {
    if (isLoading && items.length === 0) return <div className="p-4 text-center text-gray-500">جاري تحميل البريد الوارد...</div>;
    if (items.length === 0 && !isLoading) return <div className="p-4 text-center text-gray-500">لا يوجد شيء لعرضه.</div>;

    return (
        <>
            {visibleItems.map(item => {
                const Icon = item.type === 'message' ? ChatBubbleLeftEllipsisIcon : ChatBubbleOvalLeftEllipsisIcon;
                return (
                    <button key={item.id} onClick={() => handleItemSelect(item)} className={`w-full text-right p-3 border-b dark:border-gray-700 flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors ${selectedItem?.id === item.id ? 'bg-blue-50 dark:bg-gray-700' : ''}`}>
                        <div className="relative">
                            <img src={item.authorPictureUrl} alt={item.authorName} className="w-10 h-10 rounded-full flex-shrink-0" />
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
                {hasMore && (
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
    if(!selectedItem) return <div className="p-8 text-center text-gray-500 flex flex-col items-center justify-center h-full"><InboxArrowDownIcon className="w-16 h-16 mb-4 text-gray-400" /><p>اختر محادثة من القائمة لعرضها.</p></div>;

    if (selectedItem.type === 'message') {
      return (
        <div className="p-6 flex flex-col h-full">
            <div className="pb-4 border-b dark:border-gray-700 flex items-center gap-3">
              <img src={selectedItem.authorPictureUrl} alt={selectedItem.authorName} className="w-10 h-10 rounded-full" />
              <p className="font-bold text-gray-900 dark:text-white">{selectedItem.authorName}</p>
            </div>
            
            <div className="flex-grow overflow-y-auto py-4 space-y-4">
              {!selectedItem.messages ? <p className="text-center text-gray-500">جاري تحميل المحادثة...</p> : 
                selectedItem.messages.map((msg: InboxMessage) => (
                    <div key={msg.id} className={`flex ${msg.from.id !== selectedItem.authorId ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-xs md:max-w-md p-3 rounded-lg ${msg.from.id !== selectedItem.authorId ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100'}`}>
                        <p className="whitespace-pre-wrap">{msg.message}</p>
                      </div>
                    </div>
                ))
              }
            </div>

            <div className="mt-auto pt-4 border-t dark:border-gray-700 space-y-4">
                <textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="اكتب ردك هنا..." className="w-full h-24 p-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700"/>
                <div className="flex justify-between items-center">
                    <Button onClick={handleSmartReplyClick} isLoading={isGeneratingReplies} variant="secondary">
                        <SparklesIcon className="w-5 h-5 ml-2" /> اقتراح ردود
                    </Button>
                    <Button onClick={handleReplySubmit} isLoading={isReplying} disabled={!replyText.trim()}>{isReplying ? 'جاري الإرسال...' : 'إرسال الرد'}</Button>
                </div>
                 {smartReplies.length > 0 && <div className="space-y-2">{smartReplies.map((reply, i) => (<button key={i} onClick={() => setReplyText(reply)} className="w-full text-right p-2 bg-blue-50 hover:bg-blue-100 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-md text-sm text-blue-800 dark:text-blue-200 transition-colors">{reply}</button>))}</div>}
            </div>
        </div>
      );
    }
    
    // Fallback for Comments
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
            
            {selectedItem.post && <div className="py-4 text-sm"><p className="font-semibold text-gray-500 dark:text-gray-400 mb-2">في الرد على المنشور:</p><div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg flex items-center gap-3">{selectedItem.post.picture && <img src={selectedItem.post.picture} alt="Post thumbnail" className="w-12 h-12 rounded-md object-cover flex-shrink-0" />}<p className="text-gray-700 dark:text-gray-300 line-clamp-2">{selectedItem.post.message || "منشور بصورة فقط"}</p></div></div>}

            <div className="mt-auto pt-4 border-t dark:border-gray-700 space-y-4">
                <textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="اكتب ردك هنا..." className="w-full h-24 p-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700"/>
                <div className="flex justify-between items-center">
                    <Button onClick={handleSmartReplyClick} isLoading={isGeneratingReplies} variant="secondary"><SparklesIcon className="w-5 h-5 ml-2" /> اقتراح ردود</Button>
                    <Button onClick={handleReplySubmit} isLoading={isReplying} disabled={!replyText.trim()}>{isReplying ? 'جاري الإرسال...' : 'إرسال الرد'}</Button>
                </div>
                 {smartReplies.length > 0 && <div className="space-y-2">{smartReplies.map((reply, i) => (<button key={i} onClick={() => setReplyText(reply)} className="w-full text-right p-2 bg-blue-50 hover:bg-blue-100 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-md text-sm text-blue-800 dark:text-blue-200 transition-colors">{reply}</button>))}</div>}
            </div>
        </div>
    )
  }
  
  const AutoResponderSection: React.FC<{
      type: 'comments' | 'messages';
      settings: AutoResponderSettings['comments'] | AutoResponderSettings['messages'];
      onSettingsChange: (updates: Partial<AutoResponderSettings['comments'] | AutoResponderSettings['messages']>) => void;
  }> = ({ type, settings, onSettingsChange }) => {
      const title = type === 'comments' ? 'الرد التلقائي على التعليقات' : 'الرد التلقائي على الرسائل';
      const keywordsLabel = type === 'comments' ? 'الرد فقط على التعليقات التي تحتوي على:' : 'الرد فقط على الرسائل الجديدة التي تحتوي على:';
      const commonSettings = (
          <>
             <div><label htmlFor={`ar-${type}-keywords`} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{keywordsLabel}</label><input id={`ar-${type}-keywords`} type="text" value={settings.keywords} onChange={e => onSettingsChange({ keywords: e.target.value })} placeholder="مثال: السعر, بكم, تفاصيل" className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-sm" disabled={!settings.realtimeEnabled}/><p className="text-xs text-gray-500 dark:text-gray-400 mt-1">افصل بين الكلمات بفاصلة ( , ).</p></div>
          </>
      );
      return (
           <details className="group">
              <summary className="font-bold text-gray-800 dark:text-white cursor-pointer">{title}</summary>
              <div className="mt-4 space-y-4">
                  <div className="flex items-center justify-between">
                       <p className="text-sm font-medium text-gray-700 dark:text-gray-300">تفعيل الرد التلقائي الفوري:</p>
                       <label htmlFor={`ar-${type}-toggle`} className="flex items-center cursor-pointer"><div className="relative"><input type="checkbox" id={`ar-${type}-toggle`} className="sr-only" checked={settings.realtimeEnabled} onChange={e => onSettingsChange({ realtimeEnabled: e.target.checked })} /><div className="block bg-gray-600 w-14 h-8 rounded-full"></div><div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition ${settings.realtimeEnabled ? 'translate-x-6 bg-green-400' : ''}`}></div></div></label>
                  </div>
                  <div className={`space-y-4 transition-opacity duration-300 ${settings.realtimeEnabled ? 'opacity-100' : 'opacity-50'}`}>
                      {commonSettings}
                      {type === 'comments' && 'publicReplyEnabled' in settings && (
                        <>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div><div className="flex items-center mb-2"><input type="checkbox" id="public-reply-enabled" checked={settings.publicReplyEnabled} onChange={e => onSettingsChange({publicReplyEnabled: e.target.checked})} className="h-4 w-4 rounded border-gray-300" disabled={!settings.realtimeEnabled}/><label htmlFor="public-reply-enabled" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mr-2">تفعيل الرد العام</label></div><textarea value={settings.publicReplyMessage} onChange={e => onSettingsChange({ publicReplyMessage: e.target.value })} placeholder="اكتب نص الرد العام هنا..." className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-sm" rows={2} disabled={!settings.realtimeEnabled || !settings.publicReplyEnabled}/></div><div><div className="flex items-center mb-2"><input type="checkbox" id="private-reply-enabled" checked={settings.privateReplyEnabled} onChange={e => onSettingsChange({privateReplyEnabled: e.target.checked})} className="h-4 w-4 rounded border-gray-300" disabled={!settings.realtimeEnabled}/><label htmlFor="private-reply-enabled" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mr-2">تفعيل الرد الخاص</label></div><textarea value={settings.privateReplyMessage} onChange={e => onSettingsChange({ privateReplyMessage: e.target.value })} placeholder="اكتب نص الرسالة الخاصة هنا..." className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-sm" rows={2} disabled={!settings.realtimeEnabled || !settings.privateReplyEnabled}/></div></div>
                          <div className="flex items-center"><input type="checkbox" id="reply-once-enabled" checked={settings.replyOncePerUser} onChange={e => onSettingsChange({replyOncePerUser: e.target.checked})} className="h-4 w-4 rounded border-gray-300" disabled={!settings.realtimeEnabled}/><label htmlFor="reply-once-enabled" className="block text-sm text-gray-700 dark:text-gray-300 mr-2">الرد مرة واحدة فقط لكل مستخدم على نفس المنشور (موصى به).</label></div>
                        </>
                      )}
                      {type === 'messages' && 'replyMessage' in settings && (
                        <div><label htmlFor="ar-messages-reply" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">نص الرد التلقائي للرسالة:</label><textarea value={settings.replyMessage} onChange={e => onSettingsChange({ replyMessage: e.target.value })} placeholder="اكتب نص الرسالة التلقائية هنا..." className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-sm" rows={2} disabled={!settings.realtimeEnabled}/></div>
                      )}
                  </div>
              </div>
          </details>
      )
  }

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-250px)] bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden fade-in">
        <div className="w-full lg:w-1/3 border-r dark:border-gray-700 flex flex-col">
          <div className="p-3 border-b dark:border-gray-700 flex-shrink-0">
             <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <FilterButton label="الكل" active={viewFilter === 'all'} onClick={() => setViewFilter('all')} />
                    <FilterButton label="الرسائل" active={viewFilter === 'messages'} onClick={() => setViewFilter('messages')} />
                    <FilterButton label="التعليقات" active={viewFilter === 'comments'} onClick={() => setViewFilter('comments')} />
                </div>
                <Button onClick={onSync} isLoading={isSyncing} disabled={isSyncing} variant="secondary">
                  🔄 {isSyncing ? 'جاري المزامنة...' : 'مزامنة السجل'}
                </Button>
            </div>
          </div>
          <div className="overflow-y-auto">
            {renderList()}
          </div>
        </div>
        <div className="w-full lg:w-2/3 flex flex-col">
            <div className="flex-grow overflow-y-auto">
              {renderDetail()}
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-900/50 border-t dark:border-gray-700 flex-shrink-0 space-y-4">
                <AutoResponderSection 
                    type="comments"
                    settings={autoResponderSettings.comments}
                    onSettingsChange={(updates) => handleSettingsChange('comments', updates)}
                />
                 <AutoResponderSection 
                    type="messages"
                    settings={autoResponderSettings.messages}
                    onSettingsChange={(updates) => handleSettingsChange('messages', updates)}
                />
                 <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">ملاحظة: الرد التلقائي الفوري يرد على العناصر الجديدة عند تحديث البريد الوارد. استخدم {`{user_name}`} ليتم استبداله باسم المستخدم.</p>
            </div>
        </div>
    </div>
  );
};

export default InboxPage;
