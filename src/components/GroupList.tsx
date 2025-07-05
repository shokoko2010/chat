
import React, { useState } from 'react';
import { Page } from '../types';
import Checkbox from './ui/Checkbox';

interface PageListProps {
  pages: Page[];
  isLoading: boolean;
  loadingError: string | null;
  selectedPageIds: string[];
  onSelectionChange: (selectedIds: string[]) => void;
  selectionError: string | null;
}

const PageList: React.FC<PageListProps> = ({
  pages,
  isLoading,
  loadingError,
  selectedPageIds,
  onSelectionChange,
  selectionError,
}) => {
  const [selectAll, setSelectAll] = useState(false);

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    onSelectionChange(checked ? pages.map(p => p.id) : []);
  };

  const handlePageSelect = (pageId: string, checked: boolean) => {
    const newSelection = checked
      ? [...selectedPageIds, pageId]
      : selectedPageIds.filter(id => id !== pageId);
    onSelectionChange(newSelection);
    if (newSelection.length < pages.length) {
      setSelectAll(false);
    } else if (newSelection.length === pages.length && pages.length > 0) {
      setSelectAll(true);
    }
  };
  
  const renderContent = () => {
    if (isLoading) {
      return <p className="text-center text-gray-500 dark:text-gray-400">جاري تحميل صفحاتك من فيسبوك...</p>;
    }

    if (loadingError) {
      return <p className="text-center text-red-500">{loadingError}</p>;
    }

    if (pages.length === 0) {
        return <p className="text-center text-gray-500 dark:text-gray-400">لم يتم العثور على أي صفحات تديرها. تأكد من منح الإذن اللازم عند تسجيل الدخول.</p>
    }

    return (
        <div className="space-y-4">
            <div className="border-b pb-2 border-gray-200 dark:border-gray-700">
                <Checkbox
                    id="select-all"
                    label="تحديد الكل"
                    checked={selectAll}
                    onChange={handleSelectAll}
                />
            </div>
            <div className="max-h-96 overflow-y-auto pr-2">
                {pages.map(page => (
                    <div key={page.id} className="flex items-center p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md transition-colors">
                        <Checkbox
                            id={`page-${page.id}`}
                            label=""
                            checked={selectedPageIds.includes(page.id)}
                            onChange={(checked) => handlePageSelect(page.id, checked)}
                        />
                        <img src={page.picture.data.url} alt={page.name} className="w-12 h-12 rounded-lg object-cover mr-4" />
                        <div className="flex-grow">
                            <p className="font-semibold text-gray-900 dark:text-white">{page.name}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">ID: {page.id}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-white">اختر الصفحات</h2>
      
      {selectionError && <p className="text-red-500 text-sm mb-4">{selectionError}</p>}
      
      {renderContent()}
    </div>
  );
};

export default PageList;