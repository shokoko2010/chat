
import React from 'react';
import { PerformanceSummaryData } from '../types';
import KpiCard from './ui/KpiCard';
import EyeIcon from './icons/EyeIcon';
import UsersIcon from './icons/UsersIcon';
import CursorArrowRaysIcon from './icons/CursorArrowRaysIcon';

interface AnalyticsSummaryDashboardProps {
  period: '7d' | '30d';
  onPeriodChange: (period: '7d' | '30d') => void;
  summaryData: PerformanceSummaryData | null;
  aiSummary: string;
  isGeneratingSummary: boolean;
}

const AnalyticsSummaryDashboard: React.FC<AnalyticsSummaryDashboardProps> = ({
  period,
  onPeriodChange,
  summaryData,
  aiSummary,
  isGeneratingSummary
}) => {
  const kpiData = [
    { 
      label: "إجمالي الوصول", 
      value: summaryData?.totalReach.toLocaleString('ar-EG') ?? '0', 
      icon: <EyeIcon className="w-8 h-8 text-blue-500" /> 
    },
    { 
      label: "إجمالي التفاعل", 
      value: summaryData?.totalEngagement.toLocaleString('ar-EG') ?? '0', 
      icon: <UsersIcon className="w-8 h-8 text-green-500" /> 
    },
    { 
      label: "معدل التفاعل", 
      value: `${((summaryData?.engagementRate ?? 0) * 100).toFixed(2)}%`, 
      icon: <CursorArrowRaysIcon className="w-8 h-8 text-purple-500" />
    }
  ];

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white">ملخص الأداء</h2>
        <select
          value={period}
          onChange={(e) => onPeriodChange(e.target.value as '7d' | '30d')}
          className="p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="7d">آخر 7 أيام</option>
          <option value="30d">آخر 30 يومًا</option>
        </select>
      </div>

      {!summaryData ? (
        <div className="text-center text-gray-500 dark:text-gray-400 p-8 border-2 border-dashed rounded-lg">
          <h3 className="font-semibold text-lg text-gray-700 dark:text-gray-300 mb-2">لا توجد بيانات كافية</h3>
          <p>لا توجد منشورات في هذه الفترة لعرض ملخص الأداء.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* KPI Cards */}
          <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-6">
            {kpiData.map(kpi => <KpiCard key={kpi.label} {...kpi} />)}
          </div>
          
          {/* Top Posts */}
          <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
            <h4 className="font-bold text-gray-800 dark:text-white mb-3">الأفضل أداءً</h4>
            <ul className="space-y-2">
              {summaryData.topPosts.map(post => (
                <li key={post.id} className="text-sm text-gray-700 dark:text-gray-300 p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
                  <p className="truncate" title={post.text}>"{post.text || 'منشور بصورة'}"</p>
                  <p className="font-semibold text-xs text-blue-500">
                    تفاعل: {((post.analytics.likes ?? 0) + (post.analytics.comments ?? 0) + (post.analytics.shares ?? 0)).toLocaleString('ar-EG')}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          {/* AI Summary */}
          <div className="md:col-span-2 lg:col-span-4 p-4 bg-blue-50 dark:bg-gray-700/50 rounded-lg border-l-4 border-blue-500">
             <h4 className="font-bold text-gray-800 dark:text-white mb-2 flex items-center gap-2">
                <span className={`w-2 h-2 bg-blue-500 rounded-full ${isGeneratingSummary ? 'animate-pulse' : ''}`}></span>
                رؤية الذكاء الاصطناعي
            </h4>
            {isGeneratingSummary ? (
                <div className="space-y-2">
                    <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-full animate-pulse"></div>
                    <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-5/6 animate-pulse"></div>
                </div>
            ) : (
                <p className="text-gray-700 dark:text-gray-300">{aiSummary}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalyticsSummaryDashboard;
