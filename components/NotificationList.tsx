import React from 'react';
import { useApp } from '../context/AppContext';
import { X, Bell, Check } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface NotificationListProps {
  onClose: () => void;
}

const NotificationList: React.FC<NotificationListProps> = ({ onClose }) => {
  const { notifications, unreadCount, markNotificationAsRead, markAllNotificationsAsRead } = useApp();

  const handleMarkAsRead = async (id: string, isRead: boolean) => {
    if (!isRead) {
      await markNotificationAsRead(id);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (unreadCount > 0) {
      await markAllNotificationsAsRead();
    }
  };

  const formatTime = (dateString: string | Date) => {
    try {
      const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
      if (isNaN(date.getTime())) {
        return '刚刚';
      }
      return formatDistanceToNow(date, { addSuffix: true });
    } catch {
      return '刚刚';
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/50 flex items-start justify-end animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-md h-full bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-slate-900" />
            <h2 className="text-lg font-bold text-slate-900">通知</h2>
            {unreadCount > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="text-sm text-blue-500 hover:text-blue-600 font-medium"
              >
                全部已读
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded-full transition"
            >
              <X className="w-5 h-5 text-slate-900" />
            </button>
          </div>
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
              <Bell className="w-16 h-16 text-gray-300 mb-4" />
              <p className="text-gray-500 font-medium">暂无通知</p>
              <p className="text-sm text-gray-400 mt-2">当有新的交易或状态更新时，你会收到通知</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => handleMarkAsRead(notification.id, notification.isRead)}
                  className={`p-4 hover:bg-gray-50 transition cursor-pointer ${
                    !notification.isRead ? 'bg-blue-50/50' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 className="font-semibold text-slate-900 text-sm">
                          {notification.title}
                        </h3>
                        {!notification.isRead && (
                          <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1.5" />
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{notification.message}</p>
                      <p className="text-xs text-gray-400">{formatTime(notification.createdAt)}</p>
                    </div>
                    {notification.isRead && (
                      <Check className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NotificationList;
