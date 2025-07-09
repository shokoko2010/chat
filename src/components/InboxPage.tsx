
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { InboxItem, AutoResponderSettings, InboxMessage, AutoResponderRule } from '../types';
import Button from './ui/Button';
import SparklesIcon from './icons/SparklesIcon';
import InboxArrowDownIcon from './icons/InboxArrowDownIcon';
import ChatBubbleOvalLeftEllipsisIcon from './icons/ChatBubbleOvalLeftEllipsisIcon';
import ChatBubbleLeftEllipsisIcon from './icons/ChatBubbleLeftEllipsisIcon'; // For messages
import TrashIcon from './icons/TrashIcon';
import { GoogleGenAI } from '@google/genai';

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
  aiClient,
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
  const loadMoreRef = useCallback((node: HTMLElement | null) => {
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
    // This effect runs ONLY when the filtered items change (i.e., when the source `items` or `viewFilter` changes).
    // It prevents performance issues by not running on every scroll.
    const currentSelectionIsValid = selectedItem && filteredItems.some(item => item.id === selectedItem.id);

    // If the selection is not valid (e.g., filter changed and item disappeared)
    // or if no item is selected at all, then pick a new one.
    if (!currentSelectionIsValid) {
      if (filteredItems.length > 0) {
        const newSelectedItem = filteredItems[0];
        setSelectedItem(newSelectedItem);
        if (newSelectedItem.type === 'message' && !newSelectedItem.messages && newSelectedItem.conversationId) {
          onFetchMessageHistory(newSelectedItem.conversationId);
        }
      } else {
        // If there are no items in the filtered list, clear the selection.
        setSelectedItem(null);
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
        if (selectedItem.type === 'message' && selectedItem.conversationId) {
          onFetchMessageHistory(selectedItem.conversationId);
        }
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
  
  const AutoResponderRuleEditor: React.FC<{
    rule: AutoResponderRule;
    type: 'comments' | 'messages';
    onChange: (updatedRule: AutoResponderRule) => void;
    onDelete: () => void;
  }> = ({ rule, type, onChange, onDelete }) => (
    <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg border dark:border-gray-700 space-y-3">
        <div className="flex justify-between items-center">
          <p className="font-semibold text-gray-700 dark:text-gray-300">قاعدة مخصصة</p>
          <button onClick={onDelete} className="text-red-500 hover:text-red-700" title="حذف القاعدة"><TrashIcon className="w-5 h-5"/></button>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 dark:text-gray-400">إذا كانت تحتوي على (افصل بفاصلة):</label>
          <input type="text" value={rule.keywords} onChange={e => onChange({...rule, keywords: e.target.value})} placeholder="السعر, تفاصيل, خاص..." className="w-full text-sm p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"/>
        </div>
        {type === 'comments' ? (
          <>
            <div><label className="text-xs font-medium text-gray-600 dark:text-gray-400">الرد العام:</label><input type="text" value={rule.publicReplyMessage} onChange={e => onChange({...rule, publicReplyMessage: e.target.value})} placeholder="اختياري" className="w-full text-sm p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"/></div>
            <div><label className="text-xs font-medium text-gray-600 dark:text-gray-400">الرد الخاص:</label><input type="text" value={rule.privateReplyMessage} onChange={e => onChange({...rule, privateReplyMessage: e.target.value})} placeholder="اختياري" className="w-full text-sm p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"/></div>
          </>
        ) : (
          <div><label className="text-xs font-medium text-gray-600 dark:text-gray-400">نص الرسالة:</label><input type="text" value={rule.messageReply} onChange={e => onChange({...rule, messageReply: e.target.value})} placeholder="الرد التلقائي للرسالة" className="w-full text-sm p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"/></div>
        )}
    </div>
  );

  const AutoResponderSettingsSection = () => {
    const { comments, messages, fallback, replyOncePerUser } = autoResponderSettings;

    const handleRuleChange = (type: 'comments' | 'messages', updatedRule: AutoResponderRule) => {
        onAutoResponderSettingsChange({
            ...autoResponderSettings,
            [type]: {
                ...autoResponderSettings[type],
                rules: autoResponderSettings[type].rules.map(r => r.id === updatedRule.id ? updatedRule : r)
            }
        });
    };
    
    const handleAddRule = (type: 'comments' | 'messages') => {
        const newRule: AutoResponderRule = { id: `rule_${Date.now()}`, keywords: '', publicReplyMessage: '', privateReplyMessage: '', messageReply: ''};
        onAutoResponderSettingsChange({
            ...autoResponderSettings,
            [type]: { ...autoResponderSettings[type], rules: [...autoResponderSettings[type].rules, newRule]}
        });
    };

    const handleDeleteRule = (type: 'comments' | 'messages', ruleId: string) => {
        onAutoResponderSettingsChange({
            ...autoResponderSettings,
            [type]: { ...autoResponderSettings[type], rules: autoResponderSettings[type].rules.filter(r => r.id !== ruleId)}
        });
    };

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-2">🧠 الرد الاحتياطي (Fallback)</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">يعمل هذا الرد عندما لا يتطابق تعليق أو رسالة مع أي من القواعد المخصصة أدناه.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                    <div>
                        <label htmlFor="fallback-mode" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">الوضع:</label>
                        <select id="fallback-mode" value={fallback.mode} onChange={e => onAutoResponderSettingsChange({ ...autoResponderSettings, fallback: {...fallback, mode: e.target.value as any}})} className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 focus:ring-blue-500 focus:border-blue-500">
                            <option value="off">إيقاف</option>
                            <option value="static">رسالة ثابتة</option>
                            <option value="ai" disabled={!aiClient}>رد بالذكاء الاصطناعي</option>
                        </select>
                         {!aiClient && <p className="text-xs text-yellow-500 mt-1">ميزة الرد بالذكاء الاصطناعي تتطلب مفتاح API.</p>}
                    </div>
                    {fallback.mode === 'static' &&
                        <div className="transition-opacity duration-300 opacity-100">
                            <label htmlFor="fallback-message" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">نص الرسالة الثابتة:</label>
                            <input id="fallback-message" type="text" value={fallback.staticMessage} onChange={e => onAutoResponderSettingsChange({ ...autoResponderSettings, fallback: {...fallback, staticMessage: e.target.value}})} className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"/>
                        </div>
                    }
                </div>
            </div>

            <div className="border-t dark:border-gray-700 pt-4">
                 <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-2">💬 الرد على التعليقات</h3>
                 <div className="flex items-center justify-between mb-4"><p className="text-sm font-medium text-gray-700 dark:text-gray-300">تفعيل الرد على التعليقات:</p><label className="flex items-center cursor-pointer"><div className="relative"><input type="checkbox" className="sr-only" checked={comments.enabled} onChange={e => onAutoResponderSettingsChange({...autoResponderSettings, comments: {...comments, enabled: e.target.checked}})} /><div className="block bg-gray-600 w-14 h-8 rounded-full"></div><div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition ${comments.enabled ? 'translate-x-6 bg-green-400' : ''}`}></div></div></label></div>
                 <div className={`space-y-4 transition-opacity duration-300 ${comments.enabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                     <div className="flex items-center"><input type="checkbox" id="reply-once-enabled" checked={replyOncePerUser} onChange={e => onAutoResponderSettingsChange({...autoResponderSettings, replyOncePerUser: e.target.checked})} className="h-4 w-4 rounded border-gray-300" /><label htmlFor="reply-once-enabled" className="block text-sm text-gray-700 dark:text-gray-300 mr-2">الرد مرة واحدة فقط لكل مستخدم على نفس المنشور.</label></div>
                     {comments.rules.map(rule => <AutoResponderRuleEditor key={rule.id} rule={rule} type="comments" onChange={(r) => handleRuleChange('comments', r)} onDelete={() => handleDeleteRule('comments', rule.id)} />)}
                     <Button variant="secondary" size="sm" onClick={() => handleAddRule('comments')}>+ إضافة قاعدة جديدة للتعليقات</Button>
                 </div>
            </div>

            <div className="border-t dark:border-gray-700 pt-4">
                 <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-2">✉️ الرد على الرسائل</h3>
                 <div className="flex items-center justify-between mb-4"><p className="text-sm font-medium text-gray-700 dark:text-gray-300">تفعيل الرد على الرسائل:</p><label className="flex items-center cursor-pointer"><div className="relative"><input type="checkbox" className="sr-only" checked={messages.enabled} onChange={e => onAutoResponderSettingsChange({...autoResponderSettings, messages: {...messages, enabled: e.target.checked}})} /><div className="block bg-gray-600 w-14 h-8 rounded-full"></div><div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition ${messages.enabled ? 'translate-x-6 bg-green-400' : ''}`}></div></div></label></div>
                 <div className={`space-y-4 transition-opacity duration-300 ${messages.enabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                     {messages.rules.map(rule => <AutoResponderRuleEditor key={rule.id} rule={rule} type="messages" onChange={(r) => handleRuleChange('messages', r)} onDelete={() => handleDeleteRule('messages', rule.id)} />)}
                     <Button variant="secondary" size="sm" onClick={() => handleAddRule('messages')}>+ إضافة قاعدة جديدة للرسائل</Button>
                 </div>
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400 mt-4 text-center">استخدم {'{user_name}'} ليتم استبداله باسم المستخدم في رسائل الرد.</p>
        </div>
    );
  };

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
                 <div className="flex items-center gap-2">
                    <Button onClick={onSync} isLoading={isSyncing} disabled={isSyncing} variant="secondary">
                      🔄 {isSyncing ? 'جاري المزامنة...' : 'مزامنة السجل الكامل'}
                    </Button>
                </div>
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
            <details className="flex-shrink-0 bg-gray-50 dark:bg-gray-900/50 border-t dark:border-gray-700">
                <summary className="p-4 font-bold text-lg cursor-pointer text-gray-800 dark:text-white">إعدادات الرد التلقائي</summary>
                <div className="p-4 pt-0">
                    <AutoResponderSettingsSection />
                </div>
            </details>
        </div>
    </div>
  );
};

export default InboxPage;
