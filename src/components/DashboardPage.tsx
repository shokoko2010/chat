

import React, { useState, useEffect, useCallback } from 'react';
import { Target } from '../types';
import Header from './Header';
import PostComposer from './PostComposer';
import TargetList from './GroupList';
import SettingsModal from './SettingsModal';
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
    { id: '3', name: 'مطبخ الشيف', type: 'page', access_token: 'DUMMY_TOKEN_3', picture: { data: { url: 'https://via.placeholder.com/150/8B4513/FFFFFF?text=Cooking' } } },
];

const DashboardPage: React.FC<DashboardPageProps> = ({ onLogout, aiClient, currentApiKey, onSaveApiKey, isSimulationMode }) => {
  const [targets, setTargets] = useState<Target[]>([]);
  const [targetsLoading, setTargetsLoading] = useState(true);
  const [targetsError, setTargetsError] = useState<string | null>(null);
  
  const [selectedTargetIds, setSelectedTargetIds] = useState<string[]>([]);
  const [isPublishing, setIsPublishing] = useState(false);
  const [notification, setNotification] = useState<{type: 'success' | 'error' | 'partial', message: string} | null>(null);
  const [targetSelectionError, setTargetSelectionError] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    if (isSimulationMode) {
        setTargets(MOCK_TARGETS);
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
                    // Filter to include only groups where the user is an admin
                    const adminGroups = response.data.filter((group: any) => 
                        group.permissions && group.permissions.data.some((p: any) => p.permission === 'admin')
                    );
                    const groupsData = adminGroups.map((group: any) => ({ ...group, type: 'group' as 'group' }));
                    resolve(groupsData);
                } else {
                    console.warn("Could not fetch groups. The user may have denied permission.", response?.error);
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

  const handlePublish = useCallback(async (text: string, image: File | null, scheduleAt: Date | null) => {
    if (selectedTargetIds.length === 0) {
        setTargetSelectionError('يجب اختيار صفحة أو مجموعة واحدة على الأقل للنشر فيها.');
        return;
    }
    setTargetSelectionError(null);
    setIsPublishing(true);
    setNotification(null);

    const action = scheduleAt ? 'جدولة' : 'نشر';

    if (isSimulationMode) {
        console.log(`SIMULATING: Action=${action}, Text=${text}, Image=${image?.name}, Schedule=${scheduleAt}, Targets=${selectedTargetIds.join(', ')}`);
        setTimeout(() => {
            setIsPublishing(false);
            setNotification({ type: 'success', message: `تمت محاكاة ${action} المنشور بنجاح إلى ${selectedTargetIds.length} من الصفحات/المجموعات.` });
            setSelectedTargetIds([]);
            setTimeout(() => setNotification(null), 8000);
        }, 1500);
        return;
    }

    const selectedTargetsData = targets.filter(t => selectedTargetIds.includes(t.id));
    
    const publishPromises = selectedTargetsData.map(target => {
        let apiPath: string;
        let apiParams: any;

        if (image) {
            apiPath = `/${target.id}/photos`;
            const formData = new FormData();
            if (target.type === 'page') {
              formData.append('access_token', target.access_token!);
            }
            formData.append('source', image);
            if (text) formData.append('caption', text);
            if (scheduleAt) {
                formData.append('scheduled_publish_time', String(Math.floor(scheduleAt.getTime() / 1000)));
                formData.append('published', 'false');
            }
            apiParams = formData;
        } else { // Text only post
            apiPath = `/${target.id}/feed`;
            apiParams = {
                message: text,
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
    setSelectedTargetIds([]);
    setTimeout(() => setNotification(null), 8000);

  }, [selectedTargetIds, targets, isSimulationMode]);
  
  const getNotificationBgColor = () => {
    if (!notification) return '';
    switch(notification.type) {
        case 'success': return 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200';
        case 'error': return 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200';
        case 'partial': return 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200';
    }
  }

  return (
    <div className="min-h-screen fade-in">
      <Header 
        onLogout={onLogout} 
        onSettingsClick={() => setIsSettingsOpen(true)}
        isSimulationMode={isSimulationMode}
      />
      <main className="p-4 sm:p-8">
        {notification && (
            <div className={`p-4 mb-6 rounded-lg ${getNotificationBgColor()}`}>
                {notification.message}
            </div>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <PostComposer 
              onPublish={handlePublish} 
              isPublishing={isPublishing}
              aiClient={aiClient}
            />
          </div>
          <div>
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
