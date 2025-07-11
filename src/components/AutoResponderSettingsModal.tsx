import React, { useState } from 'react';
import { AutoResponderSettings, AutoResponderRule, AutoResponderAction, AutoResponderTriggerSource, AutoResponderMatchType, AutoResponderActionType } from '../types';
import Button from './ui/Button';
import SparklesIcon from './icons/SparklesIcon';
import TrashIcon from './icons/TrashIcon';
import { GoogleGenAI } from '@google/genai';
import { generateReplyVariations } from '../services/geminiService';
import GrabHandleIcon from './icons/GrabHandleIcon';

interface AutoResponderSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialSettings: AutoResponderSettings;
    onSave: (settings: AutoResponderSettings) => void;
    aiClient: GoogleGenAI | null;
}

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
  
  const handleActionChange = <K extends keyof AutoResponderAction>(actionType: AutoResponderActionType, key: K, value: AutoResponderAction[K]) => {
      onUpdate({
          ...rule,
          actions: rule.actions.map(a => 
              a.type === actionType ? { ...a, [key]: value } : a
          )
      });
  };
  
  const handleGenerateVariations = async (actionType: AutoResponderActionType) => {
    const action = rule.actions.find(a => a.type === actionType);
    if (!aiClient || !action || action.messageVariations.length === 0 || !action.messageVariations[0]) return;
    setIsGenerating(prev => ({...prev, [action.type]: true}));
    try {
      const variations = await generateReplyVariations(aiClient, action.messageVariations[0]);
      handleActionChange(actionType, 'messageVariations', variations);
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
          {rule.actions.filter(a => a.type in actionConfig && actionConfig[a.type].source === rule.trigger.source)
             .map((action) => {
                const { label } = actionConfig[action.type];
                return (
                  <div key={action.type} className="space-y-2">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id={`${rule.id}-${action.type}`}
                        checked={action.enabled}
                        onChange={e => handleActionChange(action.type, 'enabled', e.target.checked)}
                        className="h-4 w-4"
                      />
                      <label htmlFor={`${rule.id}-${action.type}`} className="mr-2 text-sm font-medium">
                        {label}
                      </label>
                    </div>
                    {action.enabled && (
                      <div className="pl-5 space-y-2">
                        <textarea
                          value={action.messageVariations.join('\n')}
                          onChange={e => handleActionChange(action.type, 'messageVariations', e.target.value.split('\n'))}
                          className="w-full text-sm p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"
                          rows={4}
                          placeholder="اكتب ردًا أو أكثر (كل رد في سطر)"
                        ></textarea>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleGenerateVariations(action.type)}
                          disabled={!aiClient || isGenerating[action.type]}
                          isLoading={isGenerating[action.type]}
                        >
                          <SparklesIcon className="w-4 h-4 ml-1" />
                          توليد تنويعات
                        </Button>
                      </div>
                    )}
                  </div>
                );
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
        <div className="p-6 space-y-6">
            <div>
                 <div className="flex justify-between items-center mb-4">
                   <h3 className="text-lg font-bold text-gray-800 dark:text-white">قواعد الرد التلقائي (الأولوية من الأعلى للأسفل)</h3>
                   <Button variant="secondary" size="sm" onClick={handleAddRule}>+ إضافة قاعدة جديدة</Button>
                 </div>
                 <div className="space-y-4 max-h-[50vh] overflow-y-auto -mr-2 pr-2">
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
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t dark:border-gray-700">
                <Button variant="secondary" onClick={onCancel}>إلغاء</Button>
                <Button onClick={() => onSave(draftSettings)}>حفظ الإعدادات</Button>
            </div>
        </div>
    );
};

const AutoResponderSettingsModal: React.FC<AutoResponderSettingsModalProps> = ({
    isOpen,
    onClose,
    initialSettings,
    onSave,
    aiClient
}) => {
    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-start p-4 sm:p-8 overflow-y-auto"
            onClick={onClose}
        >
            <div
                className="bg-gray-100 dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-5xl my-8 fade-in"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800 dark:text-white">إعدادات الرد التلقائي</h2>
                        <p className="text-gray-600 dark:text-gray-400">
                           أتمتة ردودك على التعليقات والرسائل بناءً على قواعد ذكية.
                        </p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">&times;</button>
                </div>
                <AutoResponderEditor
                    initialSettings={initialSettings}
                    onSave={onSave}
                    onCancel={onClose}
                    aiClient={aiClient}
                />
            </div>
        </div>
    );
};


export default AutoResponderSettingsModal;
