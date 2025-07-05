

import React, { useState, useEffect, useCallback } from 'react';
import { Page } from '../types';
import Header from './Header';
import PostComposer from './PostComposer';
import PageList from './GroupList';
import SettingsModal from './SettingsModal';
import { GoogleGenAI } from '@google/genai';

interface DashboardPageProps {
  onLogout: () => void;
  aiClient: GoogleGenAI | null;
  currentApiKey: string | null;
  onSaveApiKey: (key: string) => void;
  isSimulationMode: boolean;
}

const MOCK_PAGES: Page[] = [
    { id: '1', name: 'صفحة تجريبية 1', access_token: 'DUMMY_TOKEN_1', picture: { data: { url: 'https://via.placeholder.com/150/4B79A1/FFFFFF?text=Page1' } } },
    { id: '2', name: 'متجر الأزياء العصرية', access_token: 'DUMMY_TOKEN_2', picture: { data: { url: 'https://via.placeholder.com/150/C154C1/FFFFFF?text=Fashion' } } },
    { id: '3', name: 'مطبخ الشيف', access_token: 'DUMMY_TOKEN_3', picture: { data: { url: 'https://via.placeholder.com/150/8B4513/FFFFFF?text=Cooking' } } },
];

const DashboardPage: React.FC<DashboardPageProps> = ({ onLogout, aiClient, currentApiKey, onSaveApiKey, isSimulationMode }) => {
  const [pages, setPages] = useState<Page[]>([]);
  const [pagesLoading, setPagesLoading] = useState(true);
  const [pagesError, setPagesError] = useState<string | null>(null);
  
  const [selectedPageIds, setSelectedPageIds] = useState<string[]>([]);
  const [isPublishing, setIsPublishing] = useState(false);
  const [notification, setNotification] = useState<{type: 'success' | 'error' | 'partial', message: string} | null>(null);
  const [pageSelectionError, setPageSelectionError] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    if (isSimulationMode) {
        setPages(MOCK_PAGES);
        setPagesLoading(false);
        return;
    }

    setPagesLoading(true);
    setPagesError(null);
    try {
        window.FB.api(
            '/me/accounts?fields=id,name,access_token,picture{url}', 
            (response: any) => {
                if (response && !response.error) {
                    setPages(response.data);
                } else {
                    setPagesError(response?.error?.message || 'فشل في جلب الصفحات. حاول تسجيل الخروج والدخول مرة أخرى.');
                    console.error(response?.error);
                }
                setPagesLoading(false);
            }
        );
    } catch(e) {
        setPagesError('حدث خطأ فادح عند الاتصال بفيسبوك.');
        setPagesLoading(false);
    }
  }, [isSimulationMode]);

  const handlePublish = useCallback(async (text: string, image: File | null, scheduleAt: Date | null) => {
    if (selectedPageIds.length === 0) {
        setPageSelectionError('يجب اختيار صفحة واحدة على الأقل للنشر فيها.');
        return;
    }
    setPageSelectionError(null);
    setIsPublishing(true);
    setNotification(null);

    const action = scheduleAt ? 'جدولة' : 'نشر';

    if (isSimulationMode) {
        console.log(`SIMULATING: Action=${action}, Text=${text}, Image=${image?.name}, Schedule=${scheduleAt}, Pages=${selectedPageIds.join(', ')}`);
        setTimeout(() => {
            setIsPublishing(false);
            setNotification({ type: 'success', message: `تمت محاكاة ${action} المنشور بنجاح إلى ${selectedPageIds.length} صفحة.` });
            setSelectedPageIds([]);
            setTimeout(() => setNotification(null), 8000);
        }, 1500);
        return;
    }

    const selectedPagesData = pages.filter(p => selectedPageIds.includes(p.id));
    
    const publishPromises = selectedPagesData.map(page => {
        const pageAccessToken = page.access_token;
        let apiPath: string;
        let apiParams: any;

        if (image) {
            apiPath = `/${page.id}/photos`;
            const formData = new FormData();
            formData.append('access_token', pageAccessToken);
            formData.append('source', image);
            if (text) formData.append('caption', text);
            if (scheduleAt) {
                formData.append('scheduled_publish_time', String(Math.floor(scheduleAt.getTime() / 1000)));
                formData.append('published', 'false');
            }
            apiParams = formData;
        } else { // Text only post
            apiPath = `/${page.id}/feed`;
            apiParams = {
                message: text,
                access_token: pageAccessToken
            };
            if (scheduleAt) {
                apiParams.scheduled_publish_time = Math.floor(scheduleAt.getTime() / 1000);
                apiParams.published = false;
            }
        }
        
        return new Promise((resolve, reject) => {
            window.FB.api(apiPath, 'POST', apiParams, (response: any) => {
                if (response && !response.error) {
                    resolve({ pageName: page.name, success: true, response });
                } else {
                    reject({ pageName: page.name, success: false, error: response.error });
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
        message = `تم ${action} المنشور بنجاح إلى ${successfulPosts} صفحة.`;
        type = 'success';
    } else if (successfulPosts > 0 && failedPosts > 0) {
        message = `تم ${action} المنشور إلى ${successfulPosts} صفحة، وفشل في ${failedPosts} صفحة.`;
        type = 'partial';
    } else {
        message = `فشل ${action} المنشور في كل الصفحات (${failedPosts}). يرجى التحقق من الصلاحيات.`;
        type = 'error';
    }
    
    console.error("Failed posts details:", results.filter(r => r.status === 'rejected'));
    
    setNotification({ type, message });
    setSelectedPageIds([]);
    setTimeout(() => setNotification(null), 8000);

  }, [selectedPageIds, pages, isSimulationMode]);
  
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
            <PageList
              pages={pages}
              isLoading={pagesLoading}
              loadingError={pagesError}
              selectedPageIds={selectedPageIds}
              onSelectionChange={setSelectedPageIds}
              selectionError={pageSelectionError}
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