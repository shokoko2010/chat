import React, { useState } from 'react';
import { ScheduledPost } from '../types';
import PhotoIcon from './icons/PhotoIcon';
import BellIcon from './icons/BellIcon';
import TrashIcon from './icons/TrashIcon';
import CheckCircleIcon from './icons/CheckCircleIcon';
import PencilSquareIcon from './icons/PencilSquareIcon';

interface ContentCalendarProps {
    posts: ScheduledPost[];
    onDelete: (postId: string) => void;
    onEdit: (postId: string) => void;
}

const ContentCalendar: React.FC<ContentCalendarProps> = ({ posts, onDelete, onEdit }) => {
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
    today.setHours(0, 0, 0, 0); // Normalize today's date for accurate comparison

    const isToday = (day: number) => {
        const checkDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
        checkDate.setHours(0,0,0,0);
        return checkDate.getTime() === today.getTime();
    };

    const renderCalendarGrid = () => (
        <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: startDay }).map((_, i) => (
                <div key={`empty-${i}`} className="border rounded-lg border-gray-200 dark:border-gray-700/50 bg-gray-50 dark:bg-gray-800/20"></div>
            ))}
            {Array.from({ length: daysInMonth }).map((_, day) => {
                const currentDay = day + 1;
                const postsForDay = getPostsForDay(currentDay);
                const dateForThisDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDay);
                dateForThisDay.setHours(23, 59, 59, 999); // Set to end of day for past check
                const isPastDay = dateForThisDay < new Date() && !isToday(currentDay);

                return (
                    <div
                        key={currentDay}
                        className={`p-2 border rounded-lg min-h-[120px] transition-colors duration-200 ${
                            isToday(currentDay) ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30' : 
                            isPastDay ? 'bg-gray-100 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700/50' :
                            'border-gray-200 dark:border-gray-700/50'
                        } ${postsForDay.length > 0 && !isPastDay ? 'bg-gray-50 dark:bg-gray-900/20' : ''}`}
                    >
                        <div className={`font-bold ${
                            isToday(currentDay) ? 'text-blue-600 dark:text-blue-400' : 
                            isPastDay ? 'text-gray-400 dark:text-gray-500' :
                            'text-gray-700 dark:text-gray-300'
                        }`}>
                            {currentDay}
                        </div>
                        <div className="mt-1 space-y-2">
                            {postsForDay.map(post => {
                                const postDate = new Date(post.scheduledAt);
                                const hasBeenPublished = post.publishedAt || (postDate < new Date() && !post.isReminder);
                                const displayDate = post.publishedAt ? new Date(post.publishedAt) : postDate;
                                
                                return (
                                    <div key={post.id} className="group relative">
                                       <div className={`p-2 rounded-md shadow-sm border-l-4 ${
                                            hasBeenPublished 
                                                ? 'border-green-500 bg-green-50 dark:bg-green-900/20 opacity-80' 
                                                : post.isReminder 
                                                    ? 'border-yellow-500 bg-white dark:bg-gray-700' 
                                                    : 'border-blue-500 bg-white dark:bg-gray-700'
                                        }`}>
                                            <p className={`text-xs font-medium ${hasBeenPublished ? 'text-gray-600 dark:text-gray-400 line-through' : 'text-gray-800 dark:text-gray-100'} truncate pr-5`}>
                                                {post.text || 'منشور بصورة'}
                                            </p>
                                            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                <span className="font-semibold">{hasBeenPublished ? `نُشر:` : ''} {displayDate.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
                                                <div className="flex items-center gap-1">
                                                    {hasBeenPublished && <span title="تم النشر"><CheckCircleIcon className="w-4 h-4 text-green-500" /></span>}
                                                    {post.isReminder && !hasBeenPublished && <span title="تذكير لنشر انستجرام"><BellIcon className="w-4 h-4 text-yellow-500" /></span>}
                                                    {post.imageUrl && <PhotoIcon className="w-4 h-4" />}
                                                    {post.targetInfo && <img className="inline-block h-5 w-5 rounded-full ring-2 ring-white dark:ring-gray-700" src={post.targetInfo.avatarUrl} alt={post.targetInfo.name}/>}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="absolute top-1 left-1 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                            {!hasBeenPublished && !post.isReminder && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); onEdit(post.id); }}
                                                    className="p-1 bg-blue-600 text-white rounded-full hover:bg-blue-700"
                                                    title="تعديل ونشر الآن"
                                                >
                                                    <PencilSquareIcon className="w-3 h-3" />
                                                </button>
                                            )}
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onDelete(post.id); }}
                                                className="p-1 bg-red-600 text-white rounded-full hover:bg-red-700"
                                                aria-label="حذف"
                                                title="حذف"
                                            >
                                                <TrashIcon className="w-3 h-3" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
    );


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

            {renderCalendarGrid()}
        </div>
    );
};

export default ContentCalendar;