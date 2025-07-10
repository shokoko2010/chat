
import React from 'react';
import { PerformanceSummaryData, PublishedPost } from '../types';
import AnalyticsSummaryDashboard from './AnalyticsSummaryDashboard';
import PublishedPostsList from './PublishedPostsList';

interface AnalyticsPageProps {
  period: '7d' | '30d';
  onPeriodChange: (period: '7d' | '30d') => void;
  summaryData: PerformanceSummaryData | null;
  aiSummary: string;
  isGeneratingSummary: boolean;
  posts: PublishedPost[];
  isLoading: boolean;
  onFetchAnalytics: (postId: string) => void;
  onGenerateInsights: (postId: string) => void;
}

const AnalyticsPage: React.FC<AnalyticsPageProps> = ({
  period,
  onPeriodChange,
  summaryData,
  aiSummary,
  isGeneratingSummary,
  posts,
  isLoading,
  onFetchAnalytics,
  onGenerateInsights
}) => {
  return (
    <div className="space-y-8 fade-in">
      <AnalyticsSummaryDashboard
        period={period}
        onPeriodChange={onPeriodChange}
        summaryData={summaryData}
        aiSummary={aiSummary}
        isGeneratingSummary={isGeneratingSummary}
      />
      <div>
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">
          أداء المنشورات الفردية
        </h2>
        <PublishedPostsList
          posts={posts}
          isLoading={isLoading}
          onFetchAnalytics={onFetchAnalytics}
          onGenerateInsights={onGenerateInsights}
        />
      </div>
    </div>
  );
};

export default AnalyticsPage;
