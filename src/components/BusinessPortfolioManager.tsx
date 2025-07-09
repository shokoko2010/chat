
import React from 'react';
import { Business } from '../types';
import Button from './ui/Button';
import BriefcaseIcon from './icons/BriefcaseIcon';

interface BusinessPortfolioManagerProps {
  businesses: Business[];
  onLoadPages: (businessId: string) => void;
  loadingBusinessId: string | null;
  loadedBusinessIds: Record<string, boolean>;
}

const BusinessPortfolioManager: React.FC<BusinessPortfolioManagerProps> = ({ businesses, onLoadPages, loadingBusinessId, loadedBusinessIds }) => {
  if (businesses.length === 0) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-white flex items-center gap-2">
        <BriefcaseIcon className="w-6 h-6" />
        حافظات الأعمال
      </h2>
      <p className="text-gray-600 dark:text-gray-400 mb-4">
        إذا كنت لا ترى بعض صفحاتك، قم بتحميلها من حافظة الأعمال الخاصة بها.
      </p>
      <div className="space-y-3">
        {businesses.map(business => {
          const isLoading = loadingBusinessId === business.id;
          const isLoaded = !!loadedBusinessIds[business.id];
          return (
            <div key={business.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-md">
              <span className="font-semibold text-gray-900 dark:text-white">{business.name}</span>
              <Button
                size="sm"
                onClick={() => onLoadPages(business.id)}
                isLoading={isLoading}
                disabled={isLoaded || isLoading}
              >
                {isLoaded ? 'تم التحميل' : (isLoading ? 'جاري التحميل...' : 'تحميل الصفحات')}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default BusinessPortfolioManager;
