import React, { useEffect, useState } from 'react';
import { WeeklyScheduleSettings } from '../types';
import Button from './ui/Button';

interface BulkSchedulingOptionsProps {
  strategy: 'even' | 'weekly';
  onStrategyChange: (strategy: 'even' | 'weekly') => void;
  settings: WeeklyScheduleSettings;
  onSettingsChange: (settings: WeeklyScheduleSettings) => void;
  onReschedule: () => void;
}

const weekDays = [
  { id: 0, name: 'الأحد' }, { id: 1, name: 'الاثنين' }, { id: 2, name: 'الثلاثاء' },
  { id: 3, name: 'الأربعاء' }, { id: 4, name: 'الخميس' }, { id: 5, name: 'الجمعة' },
  { id: 6, name: 'السبت' },
];

const BulkSchedulingOptions: React.FC<BulkSchedulingOptionsProps> = ({
  strategy,
  onStrategyChange,
  settings,
  onSettingsChange,
  onReschedule
}) => {
    
  const handleDayToggle = (dayId: number) => {
    const newDays = settings.days.includes(dayId)
      ? settings.days.filter(d => d !== dayId)
      : [...settings.days, dayId];
    onSettingsChange({ ...settings, days: newDays });
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSettingsChange({ ...settings, time: e.target.value });
  };
  
  const handleRescheduleClick = () => {
    if (strategy === 'weekly' && settings.days.length === 0) {
        // Prevent rescheduling if no days are selected in weekly mode
        alert("يرجى اختيار يوم واحد على الأقل للجدولة الأسبوعية.");
        return;
    }
    onReschedule();
  };

  return (
    <div className="p-5 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
      <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4">الجدولة الذكية</h3>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">استراتيجية التوزيع:</label>
          <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            <button 
              onClick={() => onStrategyChange('even')}
              className={`w-1/2 p-2 rounded-md text-sm font-semibold transition-colors ${strategy === 'even' ? 'bg-white dark:bg-gray-900 shadow text-blue-600' : 'text-gray-600 dark:text-gray-300'}`}
            >
              توزيع متساوٍ
            </button>
            <button 
              onClick={() => onStrategyChange('weekly')}
              className={`w-1/2 p-2 rounded-md text-sm font-semibold transition-colors ${strategy === 'weekly' ? 'bg-white dark:bg-gray-900 shadow text-blue-600' : 'text-gray-600 dark:text-gray-300'}`}
            >
              جدولة أسبوعية
            </button>
          </div>
        </div>

        {strategy === 'weekly' && (
          <div className="p-3 border rounded-lg dark:border-gray-600 space-y-3 animate-fadeIn">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">الأيام المفضلة للنشر:</label>
              <div className="grid grid-cols-4 gap-2">
                {weekDays.map(day => (
                  <button 
                    key={day.id}
                    onClick={() => handleDayToggle(day.id)}
                    className={`p-2 rounded-md text-xs font-bold transition-colors ${settings.days.includes(day.id) ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-500'}`}
                  >
                    {day.name}
                  </button>
                ))}
              </div>
            </div>
             <div>
              <label htmlFor="schedule-time" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">وقت النشر:</label>
               <input
                id="schedule-time"
                type="time"
                value={settings.time}
                onChange={handleTimeChange}
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 border-t pt-4 dark:border-gray-700">
        <Button 
            variant="secondary" 
            className="w-full"
            onClick={handleRescheduleClick}
            disabled={strategy === 'weekly' && settings.days.length === 0}
            title={strategy === 'weekly' && settings.days.length === 0 ? "اختر يوماً على الأقل" : "أعد توزيع التواريخ بناءً على الإعدادات الجديدة"}
        >
            إعادة جدولة المنشورات
        </Button>
      </div>
    </div>
  );
};

export default BulkSchedulingOptions;