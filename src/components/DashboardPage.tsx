
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Target, PublishedPost, Draft, ScheduledPost, BulkPostItem, ContentPlanItem, ContentPlanRequest } from '../types';
import Header from './Header';
import PostComposer from './PostComposer';
import PostPreview from './PostPreview';
import PublishedPostsList from './PublishedPostsList';
import DraftsList from './DraftsList';
import ContentCalendar from './ContentCalendar';
import BulkSchedulerPage from './BulkSchedulerPage';
import ContentPlannerPage from './ContentPlannerPage';
import ReminderCard from './ReminderCard';
import { GoogleGenAI } from '@google/genai';
import { generateDescriptionForImage, analyzePageForContentPlan, generateContentPlan, generatePostInsights } from '../services/geminiService';

// Icons
import PencilSquareIcon from './icons/PencilSquareIcon';
import CalendarIcon from './icons/CalendarIcon';
import ArchiveBoxIcon from './icons/ArchiveBoxIcon';
import ChartBarIcon from './icons/ChartBarIcon';
import QueueListIcon from './icons/QueueListIcon';
import BrainCircuitIcon from './icons/BrainCircuitIcon';

interface DashboardPageProps {
  managedTarget: Target;
  allTargets: Target[];
  onChangePage: () => void;
  onLogout: () => void;
  isSimulationMode: boolean;
  aiClient: GoogleGenAI | null;
  onSettingsClick: () => void;
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

const DashboardPage: React.FC<DashboardPageProps> = ({ managedTarget, allTargets, onChangePage, onLogout, isSimulationMode, aiClient, onSettingsClick }) => {
  const [view, setView] = useState<'composer' | 'calendar' | 'drafts' | 'analytics' | 'bulk' | 'planner'>('composer');
  
  // Composer state
  const [postText, setPostText] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [composerError, setComposerError] = useState('');
  const [includeInstagram, setIncludeInstagram] = useState(false);

  // Publishing state
  const [isPublishing, setIsPublishing] = useState(false);
  const [notification, setNotification] = useState<{type: 'success' | 'error' | 'partial', message: string} | null>(null);
  const [publishingReminderId, setPublishingReminderId] = useState<string | null>(null);
  
  // Data state, managed per target
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [publishedPosts, setPublishedPosts] = useState<PublishedPost[]>([]);
  const [publishedPostsLoading, setPublishedPostsLoading] = useState(true);
  
  // Bulk Scheduler State
  const [bulkPosts, setBulkPosts] = useState<BulkPostItem[]>([]);
  const [isSchedulingAll, setIsSchedulingAll] = useState(false);

  // Content Planner State
  const [contentPlan, setContentPlan] = useState<ContentPlanItem[] | null>(null);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);


  const linkedInstagramTarget = useMemo(() => {
    if (managedTarget.type !== 'page') return null;
    return allTargets.find(t => t.type === 'instagram' && t.parentPageId === managedTarget.id) || null;
  }, [managedTarget, allTargets]);
  
  // Load data from localStorage when managedTarget changes
  useEffect(() => {
    const dataKey = `zex-pages-data-${managedTarget.id}`;
    const savedData = localStorage.getItem(dataKey);
    if (savedData) {
      const parsed = JSON.parse(savedData);
      setDrafts(parsed.drafts || []);
      setScheduledPosts(parsed.scheduledPosts ? parsed.scheduledPosts.map((p: any) => ({...p, scheduledAt: new Date(p.scheduledAt)})) : []);
      setContentPlan(parsed.contentPlan || null);
    } else {
      setDrafts([]);
      setScheduledPosts([]);
      setContentPlan(null);
    }

    // Reset composer and session-based state
    clearComposer();
    setBulkPosts([]);
    setPublishedPosts([]);
    setPublishedPostsLoading(true);
    setView('composer');

    // Fetch real published posts
    if (isSimulationMode) {
      setPublishedPostsLoading(false);
      setPublishedPosts([{
        id: 'mock_post_1', pageId: managedTarget.id, pageName: managedTarget.name, pageAvatarUrl: managedTarget.picture.data.url,
        text: 'هذا منشور تجريبي تم جلبه لهذه الصفحة.', imagePreview: 'https://via.placeholder.com/400x300/CCCCCC/FFFFFF?text=Published',
        publishedAt: new Date(Date.now() - 24 * 60 * 60 * 1000), analytics: { likes: 12, comments: 3, shares: 1, loading: false, lastUpdated: new Date() }
      }]);
      return;
    }
    
    window.FB.api(
      `/${managedTarget.id}/published_posts?fields=id,message,full_picture,created_time,likes.summary(true),comments.summary(true),shares`,
      (response: any) => {
        if (response && response.data) {
          const fetchedPosts: PublishedPost[] = response.data.map((post: any) => ({
            id: post.id, pageId: managedTarget.id, pageName: managedTarget.name, pageAvatarUrl: managedTarget.picture.data.url, text: post.message || '',
            imagePreview: post.full_picture || null, publishedAt: new Date(post.created_time),
            analytics: {
              likes: post.likes?.summary?.total_count ?? 0, comments: post.comments?.summary?.total_count ?? 0, shares: post.shares?.count ?? 0,
              loading: false, lastUpdated: new Date()
            }
          }));
          setPublishedPosts(fetchedPosts);
        } else if (response.error) {
            console.error(`Error fetching posts for ${managedTarget.name}:`, response.error);
        }
        setPublishedPostsLoading(false);
      }
    );
    
  }, [managedTarget.id, isSimulationMode]);
  
  // Save data to localStorage whenever it changes
  useEffect(() => {
    const dataKey = `zex-pages-data-${managedTarget.id}`;
    const dataToStore = { drafts, scheduledPosts, contentPlan };
    localStorage.setItem(dataKey, JSON.stringify(dataToStore));
  }, [drafts, scheduledPosts, contentPlan, managedTarget.id]);


  const clearComposer = useCallback(() => {
    setPostText(''); setSelectedImage(null); setImagePreview(null);
    setIsScheduled(false); setScheduleDate(''); setComposerError('');
    setIncludeInstagram(false);
  }, []);

  const showNotification = (type: 'success' | 'error' | 'partial', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 8000);
  };

  // --- Start Drafts Logic ---
  const handleSaveDraft = () => {
    if (!postText.trim() && !selectedImage) {
        setComposerError('لا يمكن حفظ مسودة فارغة.');
        return;
    }
    const newDraft: Draft = {
        id: `draft_${Date.now()}`, text: postText, imageFile: selectedImage,
        imagePreview: imagePreview, targetId: managedTarget.id, isScheduled, scheduleDate, includeInstagram
    };
    setDrafts(prev => [newDraft, ...prev]);
    showNotification('success', 'تم حفظ المسودة بنجاح.');
    clearComposer();
  };

  const handleLoadDraft = (draftId: string) => {
    const draft = drafts.find(d => d.id === draftId);
    if(draft) {
        setPostText(draft.text);
        setSelectedImage(draft.imageFile);
        setImagePreview(draft.imagePreview);
        setIsScheduled(draft.isScheduled);
        setScheduleDate(draft.scheduleDate);
        setIncludeInstagram(draft.includeInstagram);
        setView('composer');
        handleDeleteDraft(draftId, false); // Remove from drafts list after loading
    }
  };
  
  const handleDeleteDraft = (draftId: string, showNotif: boolean = true) => {
      setDrafts(prev => prev.filter(d => d.id !== draftId));
      if (showNotif) showNotification('success', 'تم حذف المسودة.');
  };
  // --- End Drafts Logic ---

  const publishToTarget = (target: Target, text: string, image: File | null, scheduleAt: Date | null, isReminder: boolean = false) => {
      return new Promise<{targetName: string; success: boolean, response: any}>((resolve, reject) => {
          if (isReminder) {
              const newReminder: ScheduledPost = {
                  id: `reminder_${Date.now()}`, text, scheduledAt: scheduleAt!, isReminder: true, targetId: target.id,
                  imageFile: image || undefined, imageUrl: image ? URL.createObjectURL(image) : undefined,
                  targetInfo: { name: target.name, avatarUrl: target.picture.data.url, type: 'instagram' }
              };
              setScheduledPosts(prev => [...prev, newReminder]);
              resolve({ targetName: target.name, success: true, response: { id: newReminder.id } });
              return;
          }

          if (isSimulationMode) {
              console.log(`SIMULATING PUBLISH: Target=${target.name}, Schedule=${scheduleAt}, Text=${text}`);
              setTimeout(() => resolve({ targetName: target.name, success: true, response: { id: `sim_${Date.now()}` } }), 500);
              return;
          }

          let apiPath: string, apiParams: any;
          if (image) {
              apiPath = `/${target.id}/photos`;
              const formData = new FormData();
              if (target.type === 'page' || target.type === 'instagram') formData.append('access_token', target.access_token!);
              formData.append('source', image);
              if (text) formData.append('caption', text);
              if (scheduleAt) {
                  formData.append('scheduled_publish_time', String(Math.floor(scheduleAt.getTime() / 1000)));
                  formData.append('published', 'false');
              }
              apiParams = formData;
          } else { // Text only post
              apiPath = `/${target.id}/feed`;
              apiParams = { message: text };
              if (target.type === 'page' || target.type === 'instagram') apiParams.access_token = target.access_token;
              if (scheduleAt) {
                  apiParams.scheduled_publish_time = Math.floor(scheduleAt.getTime() / 1000);
                  apiParams.published = false;
              }
          }

          window.FB.api(apiPath, 'POST', apiParams, (response: any) => {
              if (response && !response.error) {
                  resolve({ targetName: target.name, success: true, response });
              } else {
                  const errorMsg = response?.error?.message || 'Unknown error';
                  if (target.type === 'group' && errorMsg.includes('(#200) Requires installed app')) {
                      reject({ targetName: target.name, success: false, error: { ...response.error, message: `فشل النشر: يجب تثبيت التطبيق في إعدادات مجموعة "${target.name}".` } });
                  } else {
                      reject({ targetName: target.name, success: false, error: response.error });
                  }
              }
          });
      });
  };

  const handlePublishFromComposer = useCallback(async () => {
    if (!postText.trim() && !selectedImage) { setComposerError('لا يمكن نشر منشور فارغ.'); return; }
    if (includeInstagram && !selectedImage) { setComposerError('منشورات انستجرام تتطلب وجود صورة.'); return; }
    let scheduleAt: Date | null = null;
    if (isScheduled) {
        if (!scheduleDate) { setComposerError('يرجى تحديد تاريخ ووقت للجدولة.'); return; }
        const scheduleDateTime = new Date(scheduleDate);
        if(scheduleDateTime.getTime() < Date.now() + 9 * 60 * 1000) { setComposerError('يجب أن يكون وقت الجدولة بعد 10 دقائق من الآن على الأقل.'); return; }
        scheduleAt = scheduleDateTime;
    }
    setComposerError('');
    setIsPublishing(true);
    setNotification(null);
    
    const action = scheduleAt ? (includeInstagram ? 'جدولة التذكير' : 'الجدولة') : 'النشر';
    try {
        if (includeInstagram && linkedInstagramTarget) {
            // Publish to FB, create reminder for IG
            await publishToTarget(managedTarget, postText, selectedImage, scheduleAt, false);
            await publishToTarget(linkedInstagramTarget, postText, selectedImage, scheduleAt, true);
        } else {
            // Publish to FB/Group only
            await publishToTarget(managedTarget, postText, selectedImage, scheduleAt, false);
        }
        showNotification('success', `تم ${action} بنجاح!`);
        clearComposer();
    } catch (e: any) {
        console.error('Publishing error:', e);
        showNotification('error', e.error?.message || `فشل ${action}. يرجى المحاولة مرة أخرى.`);
    } finally {
        setIsPublishing(false);
    }
  }, [postText, selectedImage, isScheduled, scheduleDate, managedTarget, includeInstagram, linkedInstagramTarget, clearComposer]);
  
  const handlePublishReminder = async (postId: string) => {
    const post = scheduledPosts.find(p => p.id === postId);
    if (!post) return;
    
    setPublishingReminderId(postId);
    try {
        const target = allTargets.find(t => t.id === post.targetId);
        if (!target) throw new Error("Target not found");
        await publishToTarget(target, post.text, post.imageFile || null, null, false);
        setScheduledPosts(prev => prev.filter(p => p.id !== postId));
        showNotification('success', `تم نشر التذكير بنجاح إلى ${target.name}.`);
    } catch(e:any) {
        console.error("Reminder publishing error:", e);
        showNotification('error', e.error?.message || 'فشل نشر التذكير.');
    } finally {
        setPublishingReminderId(null);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedImage(file);
      setImagePreview(URL.createObjectURL(file));
      e.target.value = '';
    }
  };
  
  const handleGeneratedImageSelect = (file: File) => {
    setSelectedImage(file);
    setImagePreview(URL.createObjectURL(file));
  };
  
  const handleImageRemove = () => { setSelectedImage(null); setImagePreview(null); };

  const handleStartPostFromPlan = (item: ContentPlanItem) => {
    clearComposer();
    setPostText(item.postSuggestion);
    setView('composer');
  };
  
  const handleGeneratePlan = async (request: ContentPlanRequest) => {
    if (!aiClient) return;
    setIsGeneratingPlan(true);
    setPlanError(null);
    try {
        const plan = await generateContentPlan(aiClient, request);
        setContentPlan(plan);
    } catch(e: any) {
        setPlanError(e.message);
    } finally {
        setIsGeneratingPlan(false);
    }
  };

  // --- Start Analytics Logic ---
   const handleFetchPostAnalytics = (postId: string) => {
       // Placeholder for fetching single post analytics
   };
   const handleGeneratePostInsights = (postId: string) => {
       // Placeholder for generating insights
   };
  // --- End Analytics Logic ---

  const getNotificationBgColor = () => {
    if (!notification) return '';
    switch(notification.type) {
        case 'success': return 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200';
        case 'error': return 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200';
        case 'partial': return 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200';
    }
  }
  
  const upcomingReminders = scheduledPosts.filter(p => p.isReminder && new Date(p.scheduledAt) <= new Date());

  const renderActiveView = () => {
    switch (view) {
        case 'composer':
            return (
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                    <div className="lg:col-span-2">
                        <PostPreview postText={postText} imagePreview={imagePreview} pageName={managedTarget.name} pageAvatar={managedTarget.picture.data.url} />
                    </div>
                    <div className="lg:col-span-3">
                        <PostComposer aiClient={aiClient} onPublish={handlePublishFromComposer} onSaveDraft={handleSaveDraft} isPublishing={isPublishing} postText={postText}
                            onPostTextChange={setPostText} onImageChange={handleImageChange} onImageGenerated={handleGeneratedImageSelect} onImageRemove={handleImageRemove}
                            imagePreview={imagePreview} isScheduled={isScheduled} onIsScheduledChange={setIsScheduled} scheduleDate={scheduleDate}
                            onScheduleDateChange={setScheduleDate} error={composerError} managedTarget={managedTarget} linkedInstagramTarget={linkedInstagramTarget}
                            includeInstagram={includeInstagram} onIncludeInstagramChange={setIncludeInstagram}
                        />
                    </div>
                </div>
            );
        case 'bulk':
            return <BulkSchedulerPage bulkPosts={bulkPosts} onAddPosts={()=>{}} onUpdatePost={()=>{}} onRemovePost={()=>{}} onScheduleAll={()=>{}}
                isSchedulingAll={isSchedulingAll} targets={[managedTarget]} aiClient={aiClient} onGenerateDescription={()=>{}} />;
        case 'planner':
            return <ContentPlannerPage aiClient={aiClient} isGenerating={isGeneratingPlan} error={planError} plan={contentPlan}
                onGeneratePlan={handleGeneratePlan} onStartPost={handleStartPostFromPlan} targets={[managedTarget]} />;
        case 'drafts':
            return <DraftsList drafts={drafts} onLoad={handleLoadDraft} onDelete={handleDeleteDraft} />;
        case 'calendar':
            return <ContentCalendar posts={scheduledPosts} />;
        case 'analytics':
             return <PublishedPostsList posts={publishedPosts} isLoading={publishedPostsLoading}
                onFetchAnalytics={handleFetchPostAnalytics} onGenerateInsights={handleGeneratePostInsights} />;
        default: return null;
    }
  }

  return (
    <div className="min-h-screen fade-in">
      <Header onLogout={onLogout} isSimulationMode={isSimulationMode} onSettingsClick={onSettingsClick} pageName={managedTarget.name} onChangePage={onChangePage} />
      <main className="p-4 sm:p-8">
        {notification && <div className={`p-4 mb-6 rounded-lg shadow-md transition-all duration-300 ${getNotificationBgColor()}`}>{notification.message}</div>}
        
        {upcomingReminders.length > 0 && (
            <div className="mb-6 space-y-3">
                <h3 className="font-bold text-lg text-yellow-600">تذكيرات جاهزة للنشر!</h3>
                {upcomingReminders.map(post => (
                    <ReminderCard key={post.id} post={post} onPublish={() => handlePublishReminder(post.id)} isPublishing={publishingReminderId === post.id} />
                ))}
            </div>
        )}

        <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex space-x-1 sm:space-x-4 -mb-px overflow-x-auto">
                <button onClick={() => setView('composer')} className={`inline-flex items-center gap-2 px-3 sm:px-4 py-3 border-b-2 font-semibold text-sm transition-colors shrink-0 ${view === 'composer' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}>
                    <PencilSquareIcon className="w-5 h-5" /> إنشاء منشور
                </button>
                 <button onClick={() => setView('bulk')} className={`inline-flex items-center gap-2 px-3 sm:px-4 py-3 border-b-2 font-semibold text-sm transition-colors shrink-0 ${view === 'bulk' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}>
                    <QueueListIcon className="w-5 h-5" /> الجدولة المجمعة
                </button>
                <button onClick={() => setView('planner')} className={`inline-flex items-center gap-2 px-3 sm:px-4 py-3 border-b-2 font-semibold text-sm transition-colors shrink-0 ${view === 'planner' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}>
                    <BrainCircuitIcon className="w-5 h-5" /> المخطط الذكي
                </button>
                <button onClick={() => setView('drafts')} className={`inline-flex items-center gap-2 px-3 sm:px-4 py-3 border-b-2 font-semibold text-sm transition-colors shrink-0 ${view === 'drafts' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}>
                    <ArchiveBoxIcon className="w-5 h-5" /> المسودات ({drafts.length})
                </button>
                <button onClick={() => setView('calendar')} className={`inline-flex items-center gap-2 px-3 sm:px-4 py-3 border-b-2 font-semibold text-sm transition-colors shrink-0 ${view === 'calendar' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}>
                    <CalendarIcon className="w-5 h-5" /> تقويم المحتوى ({scheduledPosts.length})
                </button>
                 <button onClick={() => setView('analytics')} className={`inline-flex items-center gap-2 px-3 sm:px-4 py-3 border-b-2 font-semibold text-sm transition-colors shrink-0 ${view === 'analytics' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}>
                    <ChartBarIcon className="w-5 h-5" /> التحليلات
                </button>
            </div>
        </div>
        {renderActiveView()}
      </main>
    </div>
  );
};

export default DashboardPage;