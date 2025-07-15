
import React from 'react';
import { Draft } from '../types';
import Button from './ui/Button';
import TrashIcon from './icons/TrashIcon';

interface DraftsListProps {
  drafts: Draft[];
  onLoad: (draftId: string) => void;
  onDelete: (draftId: string) => void;
}

const DraftsList: React.FC<DraftsListProps> = ({ drafts, onLoad, onDelete }) => {
  if (drafts.length === 0) {
    return (
      <div className="text-center text-gray-500 dark:text-gray-400 p-8 border-2 border-dashed rounded-lg fade-in">
        <h3 className="font-semibold text-2xl text-gray-700 dark:text-gray-300 mb-2">لا توجد مسودات</h3>
        <p className="text-lg">عندما تحفظ منشورًا كمسودة، سيظهر هنا.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 fade-in">
      {drafts.map(draft => (
        <div key={draft.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-lg flex flex-col">
          <div className="p-5 flex-grow">
            <div className="h-40 mb-3 rounded-md overflow-hidden bg-gray-100 dark:bg-gray-700/50 flex items-center justify-center">
                {draft.imagePreview ? (
                    <img src={draft.imagePreview} alt="Draft preview" className="w-full h-full object-cover" />
                ) : draft.hasImage ? (
                    <p className="text-gray-400 dark:text-gray-500 text-center text-xs p-2">
                        تم إرفاق صورة
                        <br/>
                        (المعاينة غير متاحة بعد إعادة تحميل الصفحة)
                    </p>
                ) : (
                    <p className="text-gray-400 dark:text-gray-500">لا توجد صورة</p>
                )}
            </div>

            <p className="text-gray-700 dark:text-gray-300 h-24 overflow-hidden text-ellipsis">
              {draft.text || <span className="text-gray-400">لا يوجد نص...</span>}
            </p>
          </div>
          <div className="p-3 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-700/50 flex justify-between items-center gap-2">
            <Button 
                variant="danger" 
                onClick={() => onDelete(draft.id)} 
                className="!p-2" 
                aria-label="Delete draft"
            >
                <TrashIcon className="w-5 h-5"/>
            </Button>
            <Button onClick={() => onLoad(draft.id)} className="flex-grow">
                تحميل وتعديل
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default DraftsList;
