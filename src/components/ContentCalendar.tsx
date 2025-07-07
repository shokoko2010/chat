
import React, { useState } from 'react';
import { ScheduledPost } from '../types';
import PhotoIcon from './icons/PhotoIcon';
import BellIcon from './icons/BellIcon'; // Import the new icon

interface ContentCalendarProps {
    posts: ScheduledPost[];
}

const ContentCalendar: React.FC<ContentCalendarProps> = ({ posts }) => {
    const [currentDate, setCurrentDate] = useState(new Date());

    const daysOfWeek = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    const startDay = startOfMonth.getDay();
    const daysInMonth = endOfMonth.getDate();

    const goToPreviousMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    };

    const goToNextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    };

    const getPostsForDay = (day: number) => {
        const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
        return posts
            .filter(post => {
                const postDate = new Date(post.scheduledAt);
                return postDate.getFullYear() === date.getFullYear() &&
                       postDate.getMonth() === date.getMonth() &&
                       postDate.getDate() === date.getDate();
            })
            .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
    };

    const today = new Date();
    const isToday = (day: number) => {
        return currentDate.getFullYear() === today.getFullYear() &&
               currentDate.getMonth() === today.getMonth() &&
               day === today.getDate();
    };

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg fade-in">
            <div className="flex justify-between items-center mb-6">
                <button onClick={goToPreviousMonth} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
                    &lt; الشهر السابق
                </button>
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
                    {currentDate.toLocaleString('ar-EG', { month: 'long', year: 'numeric' })}
                </h2>
                <button onClick={goToNextMonth} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
                    الشهر التالي &gt;
                </button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center font-semibold text-gray-600 dark:text-gray-300">
                {daysOfWeek.map(day => (
                    <div key={day} className="py-2">{day}</div>
                ))}
            </div>

            <div className="grid grid-cols-7 gap-2">
                {Array.from({ length: startDay }).map((_, i) => (
                    <div key={`empty-${i}`} className="border rounded-lg border-gray-200 dark:border-gray-700/50 bg-gray-50 dark:bg-gray-800/20"></div>
                ))}
                {Array.from({ length: daysInMonth }).map((_, day) => {
                    const currentDay = day + 1;
                    const postsForDay = getPostsForDay(currentDay);
                    return (
                        <div
                            key={currentDay}
                            className={`p-2 border rounded-lg min-h-[120px] transition-colors duration-200 ${
                                isToday(currentDay) ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30' : 'border-gray-200 dark:border-gray-700/50'
                            } ${postsForDay.length > 0 ? 'bg-gray-50 dark:bg-gray-900/20' : ''}`}
                        >
                            <div className={`font-bold ${isToday(currentDay) ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}`}>
                                {currentDay}
                            </div>
                            <div className="mt-1 space-y-2">
                                {postsForDay.map(post => (
                                    <div key={post.id} className={`p-2 rounded-md shadow-sm border-l-4 ${post.isReminder ? 'border-yellow-500' : 'border-blue-500'} bg-white dark:bg-gray-700`}>
                                        <p className="text-xs font-medium text-gray-800 dark:text-gray-100 truncate">{post.text}</p>
                                        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                                            <span className="font-semibold">{new Date(post.scheduledAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
                                            <div className="flex items-center gap-1">
                                                {post.isReminder && <span title="تذكير لنشر انستجرام"><BellIcon className="w-4 h-4 text-yellow-500" /></span>}
                                                {post.imageUrl && <PhotoIcon className="w-4 h-4" />}
                                                <div className="flex -space-x-2 overflow-hidden">
                                                    {post.targets.slice(0, 3).map(t => <img key={t.id} className="inline-block h-5 w-5 rounded-full ring-2 ring-white dark:ring-gray-700" src={t.picture.data.url} alt={t.name}/>)}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default ContentCalendar;