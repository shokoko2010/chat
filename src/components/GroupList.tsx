
import React, { useState } from 'react';
import { Target } from '../types';
import Checkbox from './ui/Checkbox';

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
      return <p className="text-center text-gray-500 dark:text-gray-400">جاري تحميل الصفحات والمجموعات من فيسبوك...</p>;
    }

    if (loadingError) {
      return <p className="text-center text-red-500">{loadingError}</p>;
    }

    if (targets.length === 0) {
        return <p className="text-center text-gray-500 dark:text-gray-400">لم يتم العثور على أي صفحات أو مجموعات تديرها. تأكد من منح الإذن اللازم.</p>
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
                {targets.map(target => (
                    <div key={target.id} className="flex items-center p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md transition-colors">
                        <Checkbox
                            id={`target-${target.id}`}
                            label=""
                            checked={selectedTargetIds.includes(target.id)}
                            onChange={(checked) => handleTargetSelect(target.id, checked)}
                        />
                        <img src={target.picture.data.url} alt={target.name} className="w-12 h-12 rounded-lg object-cover mr-4" />
                        <div className="flex-grow">
                            <p className="font-semibold text-gray-900 dark:text-white">{target.name}</p>
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                target.type === 'page' 
                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' 
                                : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                            }`}>
                                {target.type === 'page' ? 'صفحة' : 'مجموعة'}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-white">اختر الصفحات والمجموعات</h2>
      
      {selectionError && <p className="text-red-500 text-sm mb-4">{selectionError}</p>}
      
      {renderContent()}
    </div>
  );
};

export default TargetList;
