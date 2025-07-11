import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Target, Business } from '../types';
import Button from './ui/Button';
import FacebookIcon from './icons/FacebookIcon';
import InstagramIcon from './icons/InstagramIcon';
import SettingsIcon from './icons/SettingsIcon';
import SearchIcon from './icons/SearchIcon';
import ChevronDownIcon from './icons/ChevronDownIcon';
import SunIcon from './icons/SunIcon';
import MoonIcon from './icons/MoonIcon';
import StarIcon from './icons/StarIcon';
import Squares2x2Icon from './icons/Squares2x2Icon';
import ListBulletIcon from './icons/ListBulletIcon';

interface PageSelectorPageProps {
  targets: Target[];
  businesses?: Business[];
  onLoadPagesFromBusiness?: (businessId: string) => void;
  loadingBusinessId?: string | null;
  loadedBusinessIds?: Set<string>;
  isLoading: boolean;
  error: string | null;
  onSelectTarget: (target: Target) => void;
  onLogout: () => void;
  onSettingsClick: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  favoriteTargetIds: Set<string>;
  onToggleFavorite: (targetId: string) => void;
}

const TargetCard: React.FC<{ target: Target; linkedInstagram: Target | null; onSelect: () => void; isFavorite: boolean; onToggleFavorite: (e: React.MouseEvent) => void; }> = ({ target, linkedInstagram, onSelect, isFavorite, onToggleFavorite }) => {
    const typeText = 'صفحة فيسبوك';

    return (
        <button
            onClick={onSelect}
            className="relative w-full bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-xl transition-all duration-300 flex flex-col h-full text-right hover:-translate-y-1"
        >
            <div className="absolute top-2 right-2 z-10">
                <button
                    onClick={onToggleFavorite}
                    className={`p-1.5 rounded-full transition-colors duration-200 ${isFavorite ? 'text-yellow-400 hover:text-yellow-500' : 'text-gray-400 hover:text-gray-500'}`}
                    aria-label={isFavorite ? 'إزالة من المفضلة' : 'إضافة للمفضلة'}
                    title={isFavorite ? 'إزالة من المفضلة' : 'إضافة للمفضلة'}
                >
                    <StarIcon className="w-6 h-6" />
                </button>
            </div>
            <div className="p-5 flex-grow">
                <div className="flex items-center gap-4">
                    <img src={target.picture.data.url} alt={target.name} className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
                    <div className="flex-grow">
                        <p className="font-bold text-lg text-gray-900 dark:text-white line-clamp-2">{target.name}</p>
                    </div>
                </div>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-700/50 flex items-center gap-2 mt-auto border-t border-gray-100 dark:border-gray-700/50">
                <FacebookIcon className="w-5 h-5 text-blue-600" />
                {linkedInstagram && <InstagramIcon className="w-5 h-5" />}
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    {typeText}
                    {linkedInstagram && ' + انستجرام'}
                </span>
            </div>
        </button>
    );
};

const TargetListItem: React.FC<{ target: Target; linkedInstagram: Target | null; onSelect: () => void; isFavorite: boolean; onToggleFavorite: (e: React.MouseEvent) => void; }> = ({ target, linkedInstagram, onSelect, isFavorite, onToggleFavorite }) => {
    return (
        <div className="w-full bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-all duration-300 flex items-center p-3 text-right">
            <button onClick={onSelect} className="flex-grow flex items-center gap-4">
                <img src={target.picture.data.url} alt={target.name} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                <div className="flex-grow">
                    <p className="font-bold text-gray-900 dark:text-white line-clamp-2">{target.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                        <FacebookIcon className="w-4 h-4 text-blue-600" />
                        {linkedInstagram && <InstagramIcon className="w-4 h-4" />}
                    </div>
                </div>
            </button>
            <div className="flex-shrink-0 ml-4">
                <button
                    onClick={onToggleFavorite}
                    className={`p-1.5 rounded-full transition-colors duration-200 ${isFavorite ? 'text-yellow-400 hover:text-yellow-500' : 'text-gray-400 hover:text-gray-500'}`}
                    aria-label={isFavorite ? 'إزالة من المفضلة' : 'إضافة للمفضلة'}
                    title={isFavorite ? 'إزالة من المفضلة' : 'إضافة للمفضلة'}
                >
                    <StarIcon className="w-6 h-6" />
                </button>
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
  isLoading,
  error,
  onSelectTarget,
  onLogout,
  onSettingsClick,
  theme,
  onToggleTheme,
  favoriteTargetIds,
  onToggleFavorite
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isPortfolioDropdownOpen, setIsPortfolioDropdownOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const portfolioRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (portfolioRef.current && !portfolioRef.current.contains(event.target as Node)) {
        setIsPortfolioDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const renderContent = () => {
    if (isLoading && targets.length === 0) {
      return <div className="text-center text-gray-500 dark:text-gray-400 py-10">جاري تحميل وجهات النشر...</div>;
    }
    if (error) {
      return <div className="text-center text-red-500 py-10">{error}</div>;
    }

    const instagramAccountsByParentId = new Map<string, Target>();
    targets.filter(t => t.type === 'instagram' && t.parentPageId).forEach(ig => {
      instagramAccountsByParentId.set(ig.parentPageId!, ig);
    });

    const primaryTargets = targets.filter(t => t.type === 'page');

    const sortedAndFilteredTargets = useMemo(() => {
        const filtered = primaryTargets.filter(target =>
            target.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
        return filtered.sort((a, b) => {
            const aIsFav = favoriteTargetIds.has(a.id);
            const bIsFav = favoriteTargetIds.has(b.id);
            if (aIsFav && !bIsFav) return -1;
            if (!aIsFav && bIsFav) return 1;
            return a.name.localeCompare(b.name, 'ar');
        });
    }, [primaryTargets, searchQuery, favoriteTargetIds]);


    if (targets.length > 0 && sortedAndFilteredTargets.length === 0) {
        return <div className="text-center text-gray-500 dark:text-gray-400 py-10">لا توجد نتائج بحث تطابق "{searchQuery}".</div>;
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
    
    return (
        <div className="space-y-8">
            {viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {sortedAndFilteredTargets.map(target => {
                        const linkedInstagram = target.type === 'page' ? instagramAccountsByParentId.get(target.id) : null;
                        return (
                            <TargetCard
                                key={target.id}
                                target={target}
                                linkedInstagram={linkedInstagram || null}
                                onSelect={() => onSelectTarget(target)}
                                isFavorite={favoriteTargetIds.has(target.id)}
                                onToggleFavorite={(e) => {
                                    e.stopPropagation();
                                    onToggleFavorite(target.id);
                                }}
                            />
                        );
                    })}
                </div>
            ) : (
                <div className="space-y-3">
                    {sortedAndFilteredTargets.map(target => {
                        const linkedInstagram = target.type === 'page' ? instagramAccountsByParentId.get(target.id) : null;
                        return (
                            <TargetListItem
                                key={target.id}
                                target={target}
                                linkedInstagram={linkedInstagram || null}
                                onSelect={() => onSelectTarget(target)}
                                isFavorite={favoriteTargetIds.has(target.id)}
                                onToggleFavorite={(e) => {
                                    e.stopPropagation();
                                    onToggleFavorite(target.id);
                                }}
                            />
                        );
                    })}
                </div>
            )}
        </div>
    );
  };

  return (
    <div className="min-h-screen fade-in">
        <header className="bg-white dark:bg-gray-800 shadow-md p-4 flex justify-between items-center">
            <h1 className="text-xl font-bold text-blue-600 dark:text-blue-400">zex-pages</h1>
            <div className="flex items-center gap-2">
                <Button onClick={onSettingsClick} variant="secondary" className="!p-2" aria-label="الإعدادات">
                    <SettingsIcon className="w-5 h-5"/>
                </Button>
                 <Button onClick={onToggleTheme} variant="secondary" className="!p-2" aria-label="تغيير المظهر">
                    {theme === 'light' ? <MoonIcon className="w-5 h-5" /> : <SunIcon className="w-5 h-5" />}
                </Button>
                <Button onClick={onLogout} variant="secondary">تسجيل الخروج</Button>
            </div>
        </header>
        <main className="p-4 sm:p-8">
            <div className="max-w-7xl mx-auto">
              <div className="md:flex justify-between items-center mb-6 gap-4">
                <h1 className="text-3xl font-bold mb-4 md:mb-0 text-gray-900 dark:text-white whitespace-nowrap">اختر وجهة لإدارتها</h1>
                 <div className="flex items-center gap-2 w-full md:w-auto mt-4 md:mt-0">
                    <div className="relative w-full md:w-72">
                        <input
                          type="search"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="ابحث عن صفحة..."
                          className="w-full p-3 pl-10 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 focus:ring-blue-500 focus:border-blue-500"
                          aria-label="البحث عن صفحة"
                        />
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <SearchIcon className="w-5 h-5 text-gray-400" />
                        </div>
                    </div>
                     <div className="flex items-center bg-gray-100 dark:bg-gray-700 p-1 rounded-lg flex-shrink-0">
                        <button onClick={() => setViewMode('grid')} className={`p-2 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-white dark:bg-gray-900 text-blue-600 shadow' : 'text-gray-500'}`} title="عرض شبكي">
                            <Squares2x2Icon className="w-5 h-5"/>
                        </button>
                        <button onClick={() => setViewMode('list')} className={`p-2 rounded-md transition-colors ${viewMode === 'list' ? 'bg-white dark:bg-gray-900 text-blue-600 shadow' : 'text-gray-500'}`} title="عرض قائمة">
                            <ListBulletIcon className="w-5 h-5"/>
                        </button>
                    </div>
                </div>
              </div>
              
                {businesses && businesses.length > 0 && onLoadPagesFromBusiness && loadingBusinessId !== undefined && loadedBusinessIds && (
                    <div className="mb-8">
                        <div className="relative inline-block text-left" ref={portfolioRef}>
                            <div>
                                <Button
                                    variant="secondary"
                                    onClick={() => setIsPortfolioDropdownOpen(prev => !prev)}
                                >
                                    تحميل من حافظة أعمال
                                    <ChevronDownIcon className={`w-5 h-5 mr-2 -ml-1 transition-transform ${isPortfolioDropdownOpen ? 'rotate-180' : ''}`} />
                                </Button>
                            </div>
                            {isPortfolioDropdownOpen && (
                                <div className="origin-top-right absolute right-0 mt-2 w-72 rounded-md shadow-lg bg-white dark:bg-gray-800 ring-1 ring-black dark:ring-gray-600 ring-opacity-5 focus:outline-none z-10">
                                    <div className="py-1">
                                        {businesses.map(business => {
                                            const isLoading = loadingBusinessId === business.id;
                                            const isLoaded = loadedBusinessIds.has(business.id);
                                            return (
                                                <button
                                                    key={business.id}
                                                    onClick={() => {
                                                        onLoadPagesFromBusiness(business.id);
                                                        setIsPortfolioDropdownOpen(false);
                                                    }}
                                                    disabled={isLoaded || isLoading}
                                                    className="w-full text-right flex justify-between items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
                                                >
                                                    <span>{business.name}</span>
                                                    {isLoading ? (
                                                        <span className="text-xs">جاري التحميل...</span>
                                                    ) : isLoaded ? (
                                                        <span className="text-xs text-green-500">تم التحميل</span>
                                                    ) : null}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
              {renderContent()}
            </div>
        </main>
    </div>
  );
};

export default PageSelectorPage;
