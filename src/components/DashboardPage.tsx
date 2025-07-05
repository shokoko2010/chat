import React, { useState, useEffect, useCallback } from 'react';
import { Target, ScheduledPost, Draft } from '../types';
import Header from './Header';
import PostComposer from './PostComposer';
import TargetList from './GroupList';
import SettingsModal from './SettingsModal';
import ContentCalendar from './ContentCalendar';
import PostPreview from './PostPreview';
import DraftsList from './DraftsList';
import PencilSquareIcon from './icons/PencilSquareIcon';
import CalendarIcon from './icons/CalendarIcon';
import ArchiveBoxIcon from './icons/ArchiveBoxIcon';
import { GoogleGenAI } from '@google/genai';

interface DashboardPageProps {
  onLogout: () => void;
  aiClient: GoogleGenAI | null;
  currentApiKey: string | null;
  onSaveApiKey: (key: string) => void;
  isSimulationMode: boolean;
}

const MOCK_TARGETS: Target[] = [
    { id: '1', name: 'صفحة تجريبية 1', type: 'page', access_token: 'DUMMY_TOKEN_1', picture: { data: { url: 'https://via.placeholder.com/150/4B79A1/FFFFFF?text=Page1' } } },
    { id: '101', name: 'مجموعة المطورين التجريبية', type: 'group', picture: { data: { url: 'https://via.placeholder.com/150/228B22/FFFFFF?text=Group1' } } },
    { id: '2', name: 'متجر الأزياء العصرية', type: 'page', access_token: 'DUMMY_TOKEN_2', picture: { data: { url: 'https://via.placeholder.com/150/C154C1/FFFFFF?text=Fashion' } } },
];

const MOCK_SCHEDULED_POSTS: ScheduledPost[] = [
    { id: 'post1', text: 'تخفيضات نهاية الأسبوع تبدأ غداً! استعدوا لأقوى العروض 🛍️', scheduledAt: new Date(new Date().setDate(new Date().getDate() + 2)), targets: [MOCK_TARGETS[0], MOCK_TARGETS[2]], imageUrl: 'https://via.placeholder.com/400x300/FFD700/000000?text=Sale' },
    { id: 'post2', text: 'ما هي لغة البرمجة التي تتعلمها حالياً؟ شاركنا في التعليقات! 💻', scheduledAt: new Date(new Date().setDate(new Date().getDate() + 4)), targets: [MOCK_TARGETS[1]] },
];


const DashboardPage: React.FC<DashboardPageProps> = ({ onLogout, aiClient, currentApiKey, onSaveApiKey, isSimulationMode }) => {
  const [view, setView] = useState<'composer' | 'calendar' | 'drafts'>('composer');
  
  // Targets state
  const [targets, setTargets] = useState<Target[]>([]);
  const [targetsLoading, setTargetsLoading] = useState(true);
  const [targetsError, setTargetsError] = useState<string | null>(null);
  
  // Composer state (lifted)
  const [postText, setPostText] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [composerError, setComposerError] = useState('');

  // Publishing state
  const [selectedTargetIds, setSelectedTargetIds] = useState<string[]>([]);
  const [isPublishing, setIsPublishing] = useState(false);
  const [notification, setNotification] = useState<{type: 'success' | 'error' | 'partial', message: string} | null>(null);
  const [targetSelectionError, setTargetSelectionError] = useState<string | null>(null);
  
  // Other state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);

  // Load initial data
  useEffect(() => {
    if (isSimulationMode) {
        setTargets(MOCK_TARGETS);
        setScheduledPosts(MOCK_SCHEDULED_POSTS);
        setTargetsLoading(false);
        return;
    }

    setTargetsLoading(true);
    setTargetsError(null);
    
    const fetchPages = new Promise<Target[]>((resolve, reject) => {
        window.FB.api(
            '/me/accounts?fields=id,name,access_token,picture{url}', 
            (response: any) => {
                if (response && !response.error) {
                    const pagesData = response.data.map((page: any) => ({ ...page, type: 'page' as 'page' }));
                    resolve(pagesData);
                } else {
                    reject(response?.error?.message || 'فشل في جلب الصفحات.');
                }
            }
        );
    });

    const fetchGroups = new Promise<Target[]>((resolve) => {
        window.FB.api(
            '/me/groups?fields=id,name,picture{url},permissions', 
            (response: any) => {
                if (response && !response.error) {
                    const adminGroups = response.data.filter((group: any) => 
                        group.permissions && group.permissions.data.some((p: any) => p.permission === 'admin')
                    );
                    const groupsData = adminGroups.map((group: any) => ({ ...group, type: 'group' as 'group' }));
                    resolve(groupsData);
                } else {
                    console.warn("Could not fetch groups:", response?.error);
                    resolve([]); 
                }
            }
        );
    });

    Promise.all([fetchPages, fetchGroups])
        .then(([pagesData, groupsData]) => {
            setTargets([...pagesData, ...groupsData]);
        })
        .catch(error => {
            console.error("Error fetching data from Facebook:", error);
            setTargetsError(typeof error === 'string' ? error : 'حدث خطأ فادح عند الاتصال بفيسبوك.');
        })
        .finally(() => {
            setTargetsLoading(false);
        });
  }, [isSimulationMode]);

  const clearComposer = useCallback(() => {
    setPostText('');
    setSelectedImage(null);
    setImagePreview(null);
    setIsScheduled(false);
    setScheduleDate('');
    setSelectedTargetIds([]);
    setComposerError('');
    setActiveDraftId(null);
  }, []);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedImage(file);
      setImagePreview(URL.createObjectURL(file));
      e.target.value = ''; // Allow re-uploading the same file
    }
  };
  
  const handleImageRemove = () => {
    setSelectedImage(null);
    setImagePreview(null);
  }

  const handlePublish = useCallback(async () => {
    // Validation
    if (!postText.trim()) {
      setComposerError('لا يمكن نشر منشور فارغ. يرجى كتابة نص أولاً.');
      return;
    }
    if (selectedTargetIds.length === 0) {
      setTargetSelectionError('يجب اختيار صفحة أو مجموعة واحدة على الأقل للنشر فيها.');
      return;
    }
    
    let scheduleAt: Date | null = null;
    if (isScheduled) {
        if (!scheduleDate) {
            setComposerError('يرجى تحديد تاريخ ووقت للجدولة.');
            return;
        }
        const scheduleDateTime = new Date(scheduleDate);
        const tenMinutesFromNow = new Date(Date.now() + 10 * 60 * 1000);
        if(scheduleDateTime < tenMinutesFromNow) {
            setComposerError('يجب أن يكون وقت الجدولة بعد 10 دقائق من الآن على الأقل.');
            return;
        }
        scheduleAt = scheduleDateTime;
    }
    
    setComposerError('');
    setTargetSelectionError(null);
    setIsPublishing(true);
    setNotification(null);

    const action = scheduleAt ? 'جدولة' : 'نشر';

    if (isSimulationMode) {
        setTimeout(() => {
            setIsPublishing(false);
            if(scheduleAt) { /* Add to calendar */ }
            if (activeDraftId) {
              setDrafts(prev => prev.filter(d => d.id !== activeDraftId));
            }
            setNotification({ type: 'success', message: `تمت محاكاة ${action} المنشور بنجاح.` });
            clearComposer();
            setTimeout(() => setNotification(null), 5000);
        }, 1500);
        return;
    }

    const selectedTargetsData = targets.filter(t => selectedTargetIds.includes(t.id));
    
    const publishPromises = selectedTargetsData.map(target => {
        let apiPath: string;
        let apiParams: any;

        if (selectedImage) {
            apiPath = `/${target.id}/photos`;
            const formData = new FormData();
            if (target.type === 'page') {
              formData.append('access_token', target.access_token!);
            }
            formData.append('source', selectedImage);
            if (postText) formData.append('caption', postText);
            if (scheduleAt) {
                formData.append('scheduled_publish_time', String(Math.floor(scheduleAt.getTime() / 1000)));
                formData.append('published', 'false');
            }
            apiParams = formData;
        } else { // Text only post
            apiPath = `/${target.id}/feed`;
            apiParams = {
                message: postText,
            };
            if (target.type === 'page') {
                apiParams.access_token = target.access_token;
            }
            if (scheduleAt) {
                apiParams.scheduled_publish_time = Math.floor(scheduleAt.getTime() / 1000);
                apiParams.published = false;
            }
        }
        
        return new Promise((resolve, reject) => {
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
    });

    const results = await Promise.allSettled(publishPromises);
    
    setIsPublishing(false);
    
    const successfulPosts = results.filter(r => r.status === 'fulfilled').length;
    const failedPosts = results.length - successfulPosts;

    let message = '';
    let type: 'success' | 'error' | 'partial' = 'error';

    if (successfulPosts > 0 && failedPosts === 0) {
        message = `تم ${action} المنشور بنجاح إلى ${successfulPosts} من الصفحات/المجموعات.`;
        type = 'success';
        if (activeDraftId) {
            setDrafts(prev => prev.filter(d => d.id !== activeDraftId));
        }
        clearComposer();
    } else if (successfulPosts > 0 && failedPosts > 0) {
        message = `تم ${action} المنشور إلى ${successfulPosts}، وفشل في ${failedPosts}.`;
        type = 'partial';
    } else {
        message = `فشل ${action} المنشور في كل الأهداف (${failedPosts}). يرجى التحقق من الصلاحيات وتثبيت التطبيق في المجموعات.`;
        type = 'error';
    }
    
    results.forEach(r => {
        if (r.status === 'rejected') {
            console.error("Post failed:", r.reason);
        }
    });
    
    setNotification({ type, message });
    if(type === 'success') {
      setSelectedTargetIds([]);
    }
    setTimeout(() => setNotification(null), 8000);

  }, [postText, selectedImage, selectedTargetIds, targets, isSimulationMode, isScheduled, scheduleDate, activeDraftId, clearComposer]);

  const handleSaveDraft = () => {
    if (!postText.trim() && !selectedImage) return;
    
    const newDraft: Draft = {
        id: `draft_${Date.now()}`,
        text: postText,
        imageFile: selectedImage,
        imagePreview: imagePreview,
        selectedTargetIds: selectedTargetIds,
    };

    setDrafts(prev => [newDraft, ...prev]);
    setNotification({ type: 'success', message: 'تم حفظ المسودة بنجاح.' });
    clearComposer();
    setTimeout(() => setNotification(null), 5000);
  };
  
  const handleLoadDraft = (draftId: string) => {
    const draft = drafts.find(d => d.id === draftId);
    if (draft) {
      setPostText(draft.text);
      setSelectedImage(draft.imageFile);
      setImagePreview(draft.imagePreview);
      setSelectedTargetIds(draft.selectedTargetIds);
      setActiveDraftId(draftId);
      setIsScheduled(false);
      setScheduleDate('');
      setView('composer');
      setNotification({ type: 'success', message: `تم تحميل المسودة "${draft.text.substring(0, 20)}...".`});
      setTimeout(() => setNotification(null), 4000);
    }
  };

  const handleDeleteDraft = (draftId: string) => {
    setDrafts(prev => prev.filter(d => d.id !== draftId));
     setNotification({ type: 'error', message: `تم حذف المسودة.`});
     setTimeout(() => setNotification(null), 4000);
  };
  
  const getNotificationBgColor = () => {
    if (!notification) return '';
    switch(notification.type) {
        case 'success': return 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200';
        case 'error': return 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200';
        case 'partial': return 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200';
    }
  }

  const firstSelectedTarget = targets.find(t => t.id === selectedTargetIds[0]);

  return (
    <div className="min-h-screen fade-in">
      <Header 
        onLogout={onLogout} 
        onSettingsClick={() => setIsSettingsOpen(true)}
        isSimulationMode={isSimulationMode}
      />
      <main className="p-4 sm:p-8">
        {notification && (
            <div className={`p-4 mb-6 rounded-lg shadow-md transition-all duration-300 ${getNotificationBgColor()}`}>
                {notification.message}
            </div>
        )}

        <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex space-x-4 -mb-px">
                <button onClick={() => setView('composer')} className={`inline-flex items-center gap-2 px-4 py-3 border-b-2 font-semibold text-sm transition-colors ${view === 'composer' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}>
                    <PencilSquareIcon className="w-5 h-5" /> إنشاء منشور
                </button>
                <button onClick={() => setView('drafts')} className={`inline-flex items-center gap-2 px-4 py-3 border-b-2 font-semibold text-sm transition-colors ${view === 'drafts' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}>
                    <ArchiveBoxIcon className="w-5 h-5" /> المسودات <span className="bg-gray-200 dark:bg-gray-700 text-xs font-bold px-2 py-0.5 rounded-full">{drafts.length}</span>
                </button>
                <button onClick={() => setView('calendar')} className={`inline-flex items-center gap-2 px-4 py-3 border-b-2 font-semibold text-sm transition-colors ${view === 'calendar' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}>
                    <CalendarIcon className="w-5 h-5" /> تقويم المحتوى
                </button>
            </div>
        </div>

        {view === 'composer' && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
            <div className="lg:col-span-2">
              <PostPreview 
                 postText={postText}
                 imagePreview={imagePreview}
                 pageName={firstSelectedTarget?.name}
                 pageAvatar={firstSelectedTarget?.picture.data.url}
              />
            </div>
            <div className="lg:col-span-3 space-y-8">
              <PostComposer 
                onPublish={handlePublish}
                onSaveDraft={handleSaveDraft}
                isPublishing={isPublishing}
                aiClient={aiClient}
                postText={postText}
                onPostTextChange={setPostText}
                onImageChange={handleImageChange}
                onImageRemove={handleImageRemove}
                imagePreview={imagePreview}
                isScheduled={isScheduled}
                onIsScheduledChange={setIsScheduled}
                scheduleDate={scheduleDate}
                onScheduleDateChange={setScheduleDate}
                error={composerError}
              />
              <TargetList
                targets={targets}
                isLoading={targetsLoading}
                loadingError={targetsError}
                selectedTargetIds={selectedTargetIds}
                onSelectionChange={setSelectedTargetIds}
                selectionError={targetSelectionError}
              />
            </div>
          </div>
        )}
        {view === 'calendar' && <ContentCalendar posts={scheduledPosts} />}
        {view === 'drafts' && <DraftsList drafts={drafts} onLoad={handleLoadDraft} onDelete={handleDeleteDraft} />}

      </main>
      <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSave={onSaveApiKey}
        currentApiKey={currentApiKey}
      />
    </div>
  );
};

export default DashboardPage;