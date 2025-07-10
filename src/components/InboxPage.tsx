
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { InboxItem, AutoResponderSettings, InboxMessage, AutoResponderRule, AutoResponderAction, AutoResponderTriggerSource, AutoResponderMatchType, AutoResponderActionType } from '../types';
import Button from './ui/Button';
import SparklesIcon from './icons/SparklesIcon';
import InboxArrowDownIcon from './icons/InboxArrowDownIcon';
import ChatBubbleOvalLeftEllipsisIcon from './icons/ChatBubbleOvalLeftEllipsisIcon';
import ChatBubbleLeftEllipsisIcon from './icons/ChatBubbleLeftEllipsisIcon'; // For messages
import TrashIcon from './icons/TrashIcon';
import { GoogleGenAI } from '@google/genai';
import { generateReplyVariations } from '../services/geminiService';
import GrabHandleIcon from './icons/GrabHandleIcon';
import CheckCircleIcon from './icons/CheckCircleIcon';

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


const TagInput: React.FC<{
  tags: string[];
  onTagsChange: (newTags: string[]) => void;
  placeholder: string;
}> = ({ tags, onTagsChange, placeholder }) => {
  const [inputValue, setInputValue] = useState('');

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const newTag = inputValue.trim();
      if (newTag && !tags.includes(newTag)) {
        onTagsChange([...tags, newTag]);
      }
      setInputValue('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    onTagsChange(tags.filter(tag => tag !== tagToRemove));
  };

  return (
    <div className="flex flex-wrap gap-2 items-center p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700">
      {tags.map(tag => (
        <span key={tag} className="flex items-center gap-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs font-semibold px-2 py-1 rounded-full">
          {tag}
          <button onClick={() => removeTag(tag)} className="text-blue-500 hover:text-blue-700">&times;</button>
        </span>
      ))}
      <input
        type="text"
        value={inputValue}
        onChange={e => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="flex-grow bg-transparent border-none focus:ring-0 p-1 text-sm"
      />
    </div>
  );
};


const AutoResponderRuleEditorCard: React.FC<{
  rule: AutoResponderRule;
  onUpdate: (updatedRule: AutoResponderRule) => void;
  onDelete: () => void;
  aiClient: GoogleGenAI | null;
}> = ({ rule, onUpdate, onDelete, aiClient }) => {
  const [isGenerating, setIsGenerating] = useState<Record<string, boolean>>({});

  const handleTriggerChange = <K extends keyof AutoResponderRule['trigger']>(key: K, value: AutoResponderRule['trigger'][K]) => {
    onUpdate({ ...rule, trigger: { ...rule.trigger, [key]: value } });
  };
  
  const handleActionChange = <K extends keyof AutoResponderAction>(index: number, key: K, value: AutoResponderAction[K]) => {
    const newActions = [...rule.actions];
    newActions[index] = { ...newActions[index], [key]: value };
    onUpdate({ ...rule, actions: newActions });
  };
  
  const handleGenerateVariations = async (actionIndex: number) => {
    const action = rule.actions[actionIndex];
    if (!aiClient || action.messageVariations.length === 0 || !action.messageVariations[0]) return;
    setIsGenerating(prev => ({...prev, [action.type]: true}));
    try {
      const variations = await generateReplyVariations(aiClient, action.messageVariations[0]);
      handleActionChange(actionIndex, 'messageVariations', variations);
    } catch (error) {
      console.error(error);
      alert('فشل إنشاء التنويعات.');
    } finally {
      setIsGenerating(prev => ({...prev, [action.type]: false}));
    }
  };

  const actionConfig: Record<AutoResponderActionType, { label: string, source: AutoResponderTriggerSource }> = {
    'public_reply': { label: 'إرسال رد عام', source: 'comment'},
    'private_reply': { label: 'إرسال رد خاص', source: 'comment'},
    'direct_message': { label: 'إرسال رسالة', source: 'message'},
  }
  
  return (
    <div className={`p-4 border rounded-lg ${!rule.enabled ? 'opacity-50' : ''} ${rule.trigger.source === 'comment' ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'}`}>
        <div className="flex items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-2 flex-grow">
                <div className="cursor-grab" title="اسحب للترتيب">
                    <GrabHandleIcon className="w-5 h-5 text-gray-400" />
                </div>
                <input type="text" value={rule.name} onChange={e => onUpdate({...rule, name: e.target.value})} placeholder="اسم القاعدة" className="font-semibold text-lg text-gray-800 dark:text-gray-200 bg-transparent border-none focus:ring-1 focus:ring-blue-500 rounded p-1 flex-grow" />
            </div>
            <div className="flex items-center gap-3">
                <label htmlFor={`enable-${rule.id}`} className="flex items-center cursor-pointer">
                    <div className="relative">
                        <input type="checkbox" id={`enable-${rule.id}`} className="sr-only" checked={rule.enabled} onChange={(e) => onUpdate({...rule, enabled: e.target.checked})} />
                        <div className={`block ${rule.enabled ? 'bg-blue-600' : 'bg-gray-400 dark:bg-gray-600'} w-12 h-6 rounded-full transition`}></div>
                        <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition ${rule.enabled ? 'transform translate-x-full' : ''}`}></div>
                    </div>
                </label>
                <button onClick={onDelete} className="text-red-500 hover:text-red-700" title="حذف القاعدة"><TrashIcon className="w-5 h-5"/></button>
            </div>
        </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Trigger Section */}
        <div className="space-y-4 p-3 bg-white dark:bg-gray-800 rounded-md shadow-sm">
          <h4 className="font-bold text-gray-700 dark:text-gray-300">المُشغّل (متى تعمل القاعدة؟)</h4>
          <div><label className="text-sm font-medium">المصدر:</label><select value={rule.trigger.source} onChange={e => handleTriggerChange('source', e.target.value as any)} className="w-full text-sm p-2 mt-1 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"><option value="comment">تعليق جديد</option><option value="message">رسالة جديدة</option></select></div>
          <div><label className="text-sm font-medium">نوع المطابقة:</label><select value={rule.trigger.matchType} onChange={e => handleTriggerChange('matchType', e.target.value as any)} className="w-full text-sm p-2 mt-1 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"><option value="any">أي كلمة</option><option value="all">كل الكلمات</option><option value="exact">مطابقة تامة</option></select></div>
          <div><label className="text-sm font-medium">الكلمات المفتاحية (اضغط Enter للإضافة):</label><TagInput tags={rule.trigger.keywords} onTagsChange={(tags) => handleTriggerChange('keywords', tags)} placeholder="السعر، بكم..."/></div>
          <div><label className="text-sm font-medium">الكلمات السلبية (تمنع القاعدة):</label><TagInput tags={rule.trigger.negativeKeywords} onTagsChange={(tags) => handleTriggerChange('negativeKeywords', tags)} placeholder="مشكلة، غالي..."/></div>
          {rule.trigger.source === 'comment' && (
              <div className="flex items-center pt-2">
                  <input type="checkbox" id={`reply-once-${rule.id}`} checked={!!rule.replyOncePerUser} onChange={e => onUpdate({...rule, replyOncePerUser: e.target.checked})} className="h-4 w-4 rounded border-gray-300" />
                  <label htmlFor={`reply-once-${rule.id}`} className="block text-sm text-gray-700 dark:text-gray-300 mr-2">الرد مرة واحدة فقط لكل مستخدم على نفس المنشور.</label>
              </div>
          )}
        </div>
        {/* Actions Section */}
        <div className="space-y-4 p-3 bg-white dark:bg-gray-800 rounded-md shadow-sm">
          <h4 className="font-bold text-gray-700 dark:text-gray-300">الإجراءات (ماذا سيحدث؟)</h4>
          {rule.actions.filter(a => actionConfig[a.type].source === rule.trigger.source).map((action, index) => {
              const fullAction = rule.actions.find(a => a.type === action.type)!;
              const fullActionIndex = rule.actions.findIndex(a => a.type === action.type);
              
              return (
                <div key={action.type} className="space-y-2">
                  <div className="flex items-center"><input type="checkbox" id={`${rule.id}-${action.type}`} checked={fullAction.enabled} onChange={e => handleActionChange(fullActionIndex, 'enabled', e.target.checked)} className="h-4 w-4" /><label htmlFor={`${rule.id}-${action.type}`} className="mr-2 text-sm font-medium">{actionConfig[action.type].label}</label></div>
                  {fullAction.enabled && (
                    <div className="pl-5 space-y-2">
                      <textarea value={fullAction.messageVariations.join('\n')} onChange={e => handleActionChange(fullActionIndex, 'messageVariations', e.target.value.split('\n'))} className="w-full text-sm p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700" rows={4} placeholder="اكتب ردًا أو أكثر (كل رد في سطر)"></textarea>
                      <Button size="sm" variant="secondary" onClick={() => handleGenerateVariations(fullActionIndex)} disabled={!aiClient || isGenerating[action.type]} isLoading={isGenerating[action.type]}>
                        <SparklesIcon className="w-4 h-4 ml-1" />
                        توليد تنويعات
                      </Button>
                    </div>
                  )}
                </div>
            )
          })}
        </div>
      </div>
    </div>
  );
};

const AutoResponderEditor: React.FC<{
  initialSettings: AutoResponderSettings;
  onSave: (settings: AutoResponderSettings) => void;
  onCancel: () => void;
  aiClient: GoogleGenAI | null;
}> = ({ initialSettings, onSave, onCancel, aiClient }) => {
    const [draftSettings, setDraftSettings] = useState(() => JSON.parse(JSON.stringify(initialSettings)));
    const [draggedRuleId, setDraggedRuleId] = useState<string | null>(null);
    const { rules, fallback } = draftSettings;
    
    const handleUpdateRule = (updatedRule: AutoResponderRule) => {
        setDraftSettings({ ...draftSettings, rules: rules.map((r:AutoResponderRule) => r.id === updatedRule.id ? updatedRule : r)});
    };
    
    const handleAddRule = () => {
        const newRule: AutoResponderRule = {
            id: `rule_${Date.now()}`,
            name: 'قاعدة جديدة',
            enabled: true,
            replyOncePerUser: true,
            trigger: { source: 'comment', matchType: 'any', keywords: [], negativeKeywords: [] },
            actions: [
              { type: 'public_reply', enabled: false, messageVariations: [] },
              { type: 'private_reply', enabled: false, messageVariations: [] },
              { type: 'direct_message', enabled: false, messageVariations: [] },
            ],
        };
        setDraftSettings({ ...draftSettings, rules: [newRule, ...rules]});
    };
    
    const handleDeleteRule = (ruleId: string) => {
      if (window.confirm("هل أنت متأكد من حذف هذه القاعدة؟")) {
        setDraftSettings({ ...draftSettings, rules: rules.filter((r:AutoResponderRule) => r.id !== ruleId)});
      }
    };
    
    const handleDragStart = (e: React.DragEvent<HTMLDivElement>, ruleId: string) => {
        e.dataTransfer.setData('ruleId', ruleId);
        setDraggedRuleId(ruleId);
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>, targetRuleId: string) => {
        e.preventDefault();
        const sourceRuleId = e.dataTransfer.getData('ruleId');
        if (sourceRuleId === targetRuleId) return;

        const sourceIndex = rules.findIndex((r:AutoResponderRule) => r.id === sourceRuleId);
        const targetIndex = rules.findIndex((r:AutoResponderRule) => r.id === targetRuleId);
        
        const reorderedRules = Array.from(rules);
        const [removed] = reorderedRules.splice(sourceIndex, 1);
        reorderedRules.splice(targetIndex, 0, removed);

        setDraftSettings({ ...draftSettings, rules: reorderedRules });
        setDraggedRuleId(null);
    };

    return (
        <div className="p-4 pt-0 fade-in">
            <div className="space-y-6">
                <div>
                     <div className="flex justify-between items-center mb-4">
                       <h3 className="text-lg font-bold text-gray-800 dark:text-white">قواعد الرد التلقائي (الأولوية من الأعلى للأسفل)</h3>
                       <Button variant="secondary" size="sm" onClick={handleAddRule}>+ إضافة قاعدة جديدة</Button>
                     </div>
                     <div className="space-y-4 max-h-[28rem] overflow-y-auto -mr-2 pr-2">
                        {rules.length > 0 ? (
                          rules.map((rule: AutoResponderRule) => (
                              <div
                                key={rule.id}
                                draggable
                                onDragStart={(e) => handleDragStart(e, rule.id)}
                                onDragOver={handleDragOver}
                                onDrop={(e) => handleDrop(e, rule.id)}
                                onDragEnd={() => setDraggedRuleId(null)}
                                className={`transition-all duration-300 ${draggedRuleId === rule.id ? 'opacity-50 scale-105' : ''}`}
                              >
                                <AutoResponderRuleEditorCard rule={rule} onUpdate={handleUpdateRule} onDelete={() => handleDeleteRule(rule.id)} aiClient={aiClient} />
                              </div>
                          ))
                        ) : (
                          <p className="text-center text-gray-500 dark:text-gray-400 py-4">لا توجد قواعد مخصصة. انقر على "إضافة قاعدة" للبدء.</p>
                        )}
                     </div>
                </div>
                
                <div className="border-t dark:border-gray-700 pt-4">
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-2">🧠 الرد الاحتياطي (Fallback)</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">يعمل هذا الرد على الرسائل الخاصة فقط عندما لا تتطابق الرسالة مع أي من القواعد المخصصة أعلاه.</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                        <div>
                            <label htmlFor="fallback-mode" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">الوضع:</label>
                            <select id="fallback-mode" value={fallback.mode} onChange={e => setDraftSettings({ ...draftSettings, fallback: {...fallback, mode: e.target.value as any}})} className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 focus:ring-blue-500 focus:border-blue-500">
                                <option value="off">إيقاف</option>
                                <option value="static">رسالة ثابتة</option>
                                <option value="ai" disabled={!aiClient}>رد بالذكاء الاصطناعي</option>
                            </select>
                             {!aiClient && <p className="text-xs text-yellow-500 mt-1">ميزة الرد بالذكاء الاصطناعي تتطلب مفتاح API.</p>}
                        </div>
                        {fallback.mode === 'static' &&
                            <div className="transition-opacity duration-300 opacity-100">
                                <label htmlFor="fallback-message" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">نص الرسالة الثابتة:</label>
                                <input id="fallback-message" type="text" value={fallback.staticMessage} onChange={e => setDraftSettings({ ...draftSettings, fallback: {...fallback, staticMessage: e.target.value}})} className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"/>
                            </div>
                        }
                    </div>
                </div>

                <p className="text-xs text-gray-500 dark:text-gray-400 mt-4 text-center">استخدم {'{user_name}'} ليتم استبداله باسم المستخدم في رسائل الرد.</p>
            </div>
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t dark:border-gray-700">
                <Button variant="secondary" onClick={onCancel}>إلغاء</Button>
                <Button onClick={() => onSave(draftSettings)}>حفظ الإعدادات</Button>
            </div>
        </div>
    );
};


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
  const [isEditingSettings, setIsEditingSettings] = useState(false);


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
    const currentSelectionIsValid = selectedItem && filteredItems.some(item => item.id === selectedItem.id);

    if (!currentSelectionIsValid) {
      if (filteredItems.length > 0) {
        const newSelectedItem = filteredItems[0];
        setSelectedItem(newSelectedItem);
        if (newSelectedItem.type === 'message' && !newSelectedItem.messages && newSelectedItem.conversationId) {
          onFetchMessageHistory(newSelectedItem.conversationId);
        }
      } else {
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

  const handleSaveSettings = (newSettings: AutoResponderSettings) => {
    onAutoResponderSettingsChange(newSettings);
    setIsEditingSettings(false);
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
                            <div className="flex items-center gap-1.5">
                                {item.isReplied && <span className="flex-shrink-0" title="تم الرد تلقائياً"><CheckCircleIcon className="w-4 h-4 text-green-500" /></span>}
                                <p className="text-sm text-gray-600 dark:text-gray-300 truncate">{item.text}</p>
                            </div>
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
            <div className="flex-shrink-0 bg-gray-50 dark:bg-gray-900/50 border-t dark:border-gray-700">
              {isEditingSettings ? (
                <AutoResponderEditor
                  initialSettings={autoResponderSettings}
                  onSave={handleSaveSettings}
                  onCancel={() => setIsEditingSettings(false)}
                  aiClient={aiClient}
                />
              ) : (
                <div className="p-4 flex justify-between items-center">
                  <p className="font-bold text-lg text-gray-800 dark:text-white">إعدادات الرد التلقائي</p>
                  <Button variant="secondary" onClick={() => setIsEditingSettings(true)}>
                    تعديل الإعدادات
                  </Button>
                </div>
              )}
            </div>
        </div>
    </div>
  );
};

export default InboxPage;