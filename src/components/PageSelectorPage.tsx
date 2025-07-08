

import React from 'react';
import { Target, Business } from '../types';
import Button from './ui/Button';
import FacebookIcon from './icons/FacebookIcon';
import InstagramIcon from './icons/InstagramIcon';
import SettingsIcon from './icons/SettingsIcon';
import BusinessPortfolioManager from './BusinessPortfolioManager';


interface PageSelectorPageProps {
  targets: Target[];
  businesses?: Business[];
  onLoadPagesFromBusiness?: (businessId: string) => void;
  loadingBusinessId?: string | null;
  loadedBusinessIds?: Set<string>;
  onSyncHistory: (target: Target) => void;
  syncingTargetId: string | null;
  isLoading: boolean;
  error: string | null;
  onSelectTarget: (target: Target) => void;
  onLogout: () => void;
  onSettingsClick: () => void;
}

const TargetCard: React.FC<{ target: Target; linkedInstagram: Target | null; onSelect: () => void; onSync: () => void; isSyncing: boolean }> = ({ target, linkedInstagram, onSelect, onSync, isSyncing }) => {
    const typeText = target.type === 'page' ? 'صفحة فيسبوك' : 'مجموعة فيسبوك';

    return (
        <div className="w-full bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-xl transition-shadow duration-300 flex flex-col h-full">
            <button
                onClick={onSelect}
                className="w-full text-right hover:-translate-y-1 transition-transform duration-300"
            >
                <div className="p-5 flex-grow">
                    <div className="flex items-center gap-4">
                        <img src={target.picture.data.url} alt={target.name} className="w-16 h-16 rounded-lg object-cover" />
                        <div className="flex-grow">
                            <p className="font-bold text-lg text-gray-900 dark:text-white line-clamp-2">{target.name}</p>
                        </div>
                    </div>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 flex items-center gap-2">
                    <FacebookIcon className="w-5 h-5 text-blue-600" />
                    {linkedInstagram && <InstagramIcon className="w-5 h-5" />}
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                        {typeText}
                        {linkedInstagram && ' + انستجرام'}
                    </span>
                </div>
            </button>
            <div className="p-2 border-t border-gray-100 dark:border-gray-700/50">
                 <Button
                    size="sm"
                    variant="secondary"
                    className="w-full"
                    onClick={onSync}
                    isLoading={isSyncing}
                    disabled={isSyncing}
                 >
                   🔄 {isSyncing ? 'جاري المزامنة...' : 'مزامنة السجل الكامل'}
                 </Button>
            </div>
        </div>
    );
};


const PageSelectorPage: React.FC<PageSelectorPageProps> = ({
  targets,
  businesses,
  onLoadPagesFromBusiness,
  loadingBusinessId,
  loadedBusinessIds,
  onSyncHistory,
  syncingTargetId,
  isLoading,
  error,
  onSelectTarget,
  onLogout,
  onSettingsClick,
}) => {

  const renderContent = () => {
    if (isLoading && targets.length === 0) {
      return <div className="text-center text-gray-500 dark:text-gray-400 py-10">جاري تحميل وجهات النشر...</div>;
    }
    if (error) {
      return <div className="text-center text-red-500 py-10">{error}</div>;
    }
    if (targets.length === 0 && !isLoading) {
      return (
        <div className="text-center text-gray-500 dark:text-gray-400 p-8 border-2 border-dashed rounded-lg">
          <h3 className="font-semibold text-xl text-gray-700 dark:text-gray-300 mb-2">لم يتم العثور على أي وجهات</h3>
          <p className="text-sm mb-4">قد يكون هذا بسبب عدم منح التطبيق صلاحية الوصول لأي من صفحاتك.</p>
          <div className="text-right bg-yellow-50 dark:bg-gray-700 p-3 rounded-md space-y-2">
            <p className="font-bold text-yellow-800 dark:text-yellow-200">💡 الحل المقترح:</p>
            <ol className="list-decimal list-inside text-sm space-y-1">
              <li>قم بتسجيل الخروج ثم تسجيل الدخول مرة أخرى.</li>
              <li>في نافذة فيسبوك، انقر على "تعديل الوصول" (Edit Access).</li>
              <li>تأكد من تفعيل وتحديد جميع الصفحات التي ترغب في إدارتها.</li>
              <li>وافق على جميع الصلاحيات المطلوبة.</li>
            </ol>
          </div>
        </div>
      );
    }
    
    const instagramAccountsByParentId = new Map<string, Target>();
    targets.filter(t => t.type === 'instagram' && t.parentPageId).forEach(ig => {
      instagramAccountsByParentId.set(ig.parentPageId!, ig);
    });

    const primaryTargets = targets.filter(t => t.type === 'page' || t.type === 'group');

    return (
        <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {primaryTargets.map(target => {
                    const linkedInstagram = target.type === 'page' ? instagramAccountsByParentId.get(target.id) : null;
                    return (
                        <TargetCard
                            key={target.id}
                            target={target}
                            linkedInstagram={linkedInstagram || null}
                            onSelect={() => onSelectTarget(target)}
                            onSync={() => onSyncHistory(target)}
                            isSyncing={syncingTargetId === target.id}
                        />
                    );
                })}
            </div>
        </div>
    );
  };

  return (
    <div className="min-h-screen fade-in">
        <header className="bg-white dark:bg-gray-800 shadow-md p-4 flex justify-between items-center">
            <h1 className="text-xl font-bold text-blue-600 dark:text-blue-400">zex-pages</h1>
            <div className="flex items-center gap-2">
                <button 
                  onClick={onSettingsClick} 
                  className="p-2 rounded-full text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  aria-label="الإعدادات"
                >
                  <SettingsIcon className="w-6 h-6" />
                </button>
                <Button onClick={onLogout} variant="secondary">تسجيل الخروج</Button>
            </div>
        </header>
        <main className="p-4 sm:p-8">
            <div className="max-w-7xl mx-auto">
              <div className="md:flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold mb-4 md:mb-0 text-gray-900 dark:text-white">اختر وجهة لإدارتها</h1>
                {(isLoading || syncingTargetId) && <p className="text-gray-500 animate-pulse">{syncingTargetId ? 'جاري مزامنة السجل...' : 'جاري تحديث القائمة...'}</p>}
              </div>
              
              {businesses && businesses.length > 0 && onLoadPagesFromBusiness && loadingBusinessId !== undefined && loadedBusinessIds && (
                <div className="mb-8">
                    <BusinessPortfolioManager 
                        businesses={businesses}
                        onLoadPages={onLoadPagesFromBusiness}
                        loadingBusinessId={loadingBusinessId}
                        loadedBusinessIds={loadedBusinessIds}
                    />
                </div>
              )}
              {renderContent()}
            </div>
        </main>
    </div>
  );
};

export default PageSelectorPage;