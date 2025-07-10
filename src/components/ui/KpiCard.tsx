
import React from 'react';

interface KpiCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

const KpiCard: React.FC<KpiCardProps> = ({ icon, label, value }) => {
  return (
    <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg flex items-center gap-4 shadow-sm">
      <div className="bg-white dark:bg-gray-800 p-3 rounded-full">
        {icon}
      </div>
      <div>
        <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">{label}</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      </div>
    </div>
  );
};

export default KpiCard;
