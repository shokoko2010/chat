
import React, { useState } from 'react';
import { Target } from '../types';
import Checkbox from './ui/Checkbox';
import InstagramIcon from './icons/InstagramIcon';

interface TargetListProps {
  targets: Target[];
  isLoading: boolean;
  loadingError: string | null;
  selectedTargetIds: string[];
  onSelectionChange: (selectedIds: string[]) => void;
  selectionError: string | null;
}

const TargetList: React.FC<TargetListProps> = ({
  targets,
  isLoading,
  loadingError,
  selectedTargetIds,
  onSelectionChange,
  selectionError,
}) => {
  const [selectAll, setSelectAll] = useState(false);

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    onSelectionChange(checked ? targets.map(t => t.id) : []);
  };

  const handleTargetSelect = (targetId: string, checked: boolean) => {
    const newSelection = checked
      ? [...selectedTargetIds, targetId]
      : selectedTargetIds.filter(id => id !== targetId);
    onSelectionChange(newSelection);
    if (newSelection.length < targets.length) {
      setSelectAll(false);
    } else if (newSelection.length === targets.length && targets.length > 0) {
      setSelectAll(true);
    }
  };
  
  const renderContent = () => {
    if (isLoading) {
      return <p className="text-center text-gray-500 dark:text-gray-400">جاري تحميل الصفحات والوجهات من فيسبوك...</p>;
    }

    if (loadingError) {
      return <p className="text-center text-red-500">{loadingError}</p>;
    }

    if (targets.length === 0) {
        return (
            <div className="text-center text-gray-500 dark:text-gray-400 p-4 border-2 border-dashed rounded-lg">
                <h3 className="font-semibold text-lg text-gray-700 dark:text-gray-300 mb-2">لم يتم العثور على أي وجهات</h3>
                <p className="text-sm">لم نعثر على صفحات تديرها، أو أنك لم تقم بربط حساب انستجرام بعد.</p>
                <div className="mt-4 text-right bg-gray-100 dark:bg-gray-700 p-3 rounded-md">
                    <p className="font-bold text-gray-800 dark:text-gray-200">لإضافة وجهات:</p>
                    <ul className="list-disc list-inside text-sm space-y-1 mt-1">
                        <li>تأكد من أنك مسؤول (Admin) عن الصفحات التي تريد إدارتها.</li>
                        <li>لربط انستجرام، تأكد أن حسابك هو "حساب أعمال" ومرتبط بصفحة فيسبوك.</li>
                        <li>لإدارة المجموعات، يجب أن تكون مسؤولاً وتضيف التطبيق في إعدادات المجموعة.</li>
                    </ul>
                </div>
            </div>
        );
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
                {targets.map(target => {
                    const getBadgeStyle = () => {
                        switch (target.type) {
                            case 'page':
                                return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
                            case 'group':
                                return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
                            case 'instagram':
                                return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
                            default:
                                return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
                        }
                    };

                     const getTypeText = () => {
                        switch (target.type) {
                            case 'page': return 'صفحة';
                            case 'group': return 'مجموعة';
                            case 'instagram': return 'انستجرام';
                            default: return 'غير معروف';
                        }
                    };

                    return (
                        <div key={target.id} className="flex items-center p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md transition-colors">
                            <Checkbox
                                id={`target-${target.id}`}
                                label=""
                                checked={selectedTargetIds.includes(target.id)}
                                onChange={(checked) => handleTargetSelect(target.id, checked)}
                            />
                            <div className="relative mx-4">
                               <img src={target.picture.data.url} alt={target.name} className="w-12 h-12 rounded-lg object-cover" />
                               {target.type === 'instagram' && (
                                   <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 shadow-md">
                                        <InstagramIcon className="w-4 h-4" />
                                   </div>
                               )}
                            </div>
                            <div className="flex-grow">
                                <p className="font-semibold text-gray-900 dark:text-white">{target.name}</p>
                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${getBadgeStyle()}`}>
                                    {getTypeText()}
                                </span>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-white">اختر وجهات النشر</h2>
      
      {selectionError && <p className="text-red-500 text-sm mb-4">{selectionError}</p>}
      
      {renderContent()}
    </div>
  );
};

export default TargetList;
