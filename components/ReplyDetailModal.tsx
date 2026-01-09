import React, { useState, useEffect } from 'react';
import { Transaction, TransactionReply, timeAgo, Privacy, formatCurrency, TransactionType } from '../utils';
import { useApp } from '../context/AppContext';
import { X, Send, Upload, Twitter, MessageCircle, Heart, ArrowLeft } from 'lucide-react';
import { Services } from '../services';

interface ReplyDetailModalProps {
  transaction: Transaction;
  onClose: () => void;
  onUserClick?: (user: any) => void;
}

const ReplyDetailModal: React.FC<ReplyDetailModalProps> = ({ transaction: initialTransaction, onClose, onUserClick }) => {
  const { currentUser, refreshFeed, feed } = useApp();
  const [transaction, setTransaction] = useState(initialTransaction);
  const [commentText, setCommentText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // 从 feed 中获取最新的交易数据
  useEffect(() => {
    const updatedTransaction = feed.find(t => t.id === transaction.id);
    if (updatedTransaction) {
      setTransaction(updatedTransaction);
    }
  }, [feed, transaction.id]);

  // 所有回复按时间排序
  const allReplies = (transaction.replies || []).sort((a, b) => a.timestamp - b.timestamp);

  // 压缩图片
  const compressImage = (file: File, maxWidth: number = 1200, maxHeight: number = 1200, quality: number = 0.7): Promise<File> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxWidth) {
              height = (height * maxWidth) / width;
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = (width * maxHeight) / height;
              height = maxHeight;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('无法创建画布上下文'));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('图片压缩失败'));
                return;
              }
              const compressedFile = new File([blob], file.name, {
                type: file.type,
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            },
            file.type,
            quality
          );
        };
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // 将文件转换为 base64
  const fileToBase64 = async (file: File): Promise<string> => {
    try {
      let fileToConvert = file;
      if (file.size > 1024 * 1024) {
        fileToConvert = await compressImage(file, 1200, 1200, 0.7);
      }

      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          if (result.length > 500 * 1024) {
            compressImage(fileToConvert, 800, 800, 0.6)
              .then((compressed) => {
                const reader2 = new FileReader();
                reader2.onload = () => resolve(reader2.result as string);
                reader2.onerror = reject;
                reader2.readAsDataURL(compressed);
              })
              .catch(reject);
          } else {
            resolve(result);
          }
        };
        reader.onerror = reject;
        reader.readAsDataURL(fileToConvert);
      });
    } catch (error) {
      console.error('图片处理失败:', error);
      throw new Error('图片处理失败，请尝试使用更小的图片');
    }
  };

  const handleSubmitComment = async () => {
    if (!currentUser) {
      alert('请先登录才能评论');
      return;
    }
    if (!commentText.trim() && !file) {
      alert('请添加评论内容或上传图片');
      return;
    }

    setIsProcessing(true);
    try {
      let proofUrl: string | undefined;
      if (file) {
        proofUrl = await fileToBase64(file);
      }

      await Services.socialInteractions.addComment(transaction.id, commentText || ' ', proofUrl);
      setCommentText('');
      setFile(null);
      await refreshFeed();
    } catch (error: any) {
      console.error('Failed to add comment:', error);
      alert(error?.message || '评论失败，请重试');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-gray-50 flex items-center justify-center">
      <div className="w-full max-w-md h-full bg-white shadow-2xl flex flex-col relative overflow-hidden">
        {/* Header - 类似 X 的顶部导航 */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-4 z-10">
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition"
          >
            <ArrowLeft className="w-5 h-5 text-slate-900" />
          </button>
          <h2 className="text-lg font-bold text-slate-900">回复</h2>
        </div>

      {/* Original Post - 类似 X 的原始推文展示 */}
      <div className="border-b border-gray-200 px-4 py-4">
        <div className="flex gap-3">
          <img
            src={transaction.fromUser.avatar}
            className="w-10 h-10 rounded-full flex-shrink-0 cursor-pointer"
            alt={transaction.fromUser.name}
            onClick={() => onUserClick && onUserClick(transaction.fromUser)}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span
                className="font-bold text-slate-900 cursor-pointer hover:underline"
                onClick={() => onUserClick && onUserClick(transaction.fromUser)}
              >
                {transaction.fromUser.name}
              </span>
              <span className="text-sm text-gray-500">@{transaction.fromUser.handle}</span>
              <span className="text-gray-400">·</span>
              <span className="text-sm text-gray-500">{timeAgo(transaction.timestamp)}</span>
              {transaction.privacy === Privacy.PUBLIC_X && transaction.xPostId && (
                <a
                  href={`https://twitter.com/i/web/status/${transaction.xPostId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto text-sky-500 hover:text-sky-600"
                  title="在 X 上查看"
                >
                  <Twitter className="w-4 h-4" />
                </a>
              )}
            </div>
            <p className="text-sm text-slate-900 mb-3 whitespace-pre-wrap break-words leading-relaxed">
              {transaction.note}
            </p>
            {transaction.sticker && (
              <span className="text-2xl inline-block mb-3">{transaction.sticker}</span>
            )}
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold mb-3 ${
              transaction.type === TransactionType.PAYMENT 
                ? 'bg-emerald-50 text-emerald-600' 
                : 'bg-blue-50 text-blue-600'
            }`}>
              {transaction.type === TransactionType.PAYMENT ? '+' : ''} {formatCurrency(transaction.amount, transaction.currency)}
            </div>
            <div className="flex items-center gap-6 text-sm text-gray-500 pt-2 border-t border-gray-100">
              <div className="flex items-center gap-1">
                <span className="font-semibold text-slate-900">{transaction.likes}</span>
                <span>点赞</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="font-semibold text-slate-900">{transaction.comments}</span>
                <span>回复</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Replies List - 类似 X 的回复时间线 */}
      <div className="flex-1 overflow-y-auto">
        {allReplies.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <MessageCircle className="w-12 h-12 text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium mb-1">还没有回复</p>
            <p className="text-sm text-gray-400">成为第一个回复的人吧！</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {allReplies.map((reply, index) => (
              <div key={reply.id} className="px-4 py-4 hover:bg-gray-50/50 transition-colors">
                <div className="flex gap-3">
                  <img
                    src={reply.user.avatar}
                    className="w-10 h-10 rounded-full flex-shrink-0 cursor-pointer hover:opacity-80 transition"
                    alt={reply.user.name}
                    onClick={() => onUserClick && onUserClick(reply.user)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="font-bold text-slate-900 cursor-pointer hover:underline"
                        onClick={() => onUserClick && onUserClick(reply.user)}
                      >
                        {reply.user.name}
                      </span>
                      <span className="text-sm text-gray-500">@{reply.user.handle}</span>
                      <span className="text-gray-400">·</span>
                      <span className="text-sm text-gray-500">{timeAgo(reply.timestamp)}</span>
                      {reply.privacy === Privacy.PUBLIC_X && reply.xCommentId && (
                        <a
                          href={`https://twitter.com/i/web/status/${transaction.xPostId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-auto text-sky-500 hover:text-sky-600"
                          title="在 X 上查看"
                        >
                          <Twitter className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                    <p className="text-sm text-slate-900 mb-2 whitespace-pre-wrap break-words leading-relaxed">
                      {reply.text}
                    </p>
                    {reply.proof && (
                      <div className="mt-2 rounded-xl overflow-hidden border border-gray-200">
                        <img
                          src={reply.proof}
                          className="w-full max-h-96 object-cover"
                          alt="Payment Proof"
                          onError={(e) => {
                            console.error('图片加载失败:', reply.proof);
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Comment Input - 固定在底部，类似 X 的回复输入框 */}
      {currentUser && (
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-4 py-3">
          <div className="flex gap-3">
            <img
              src={currentUser.avatar}
              className="w-10 h-10 rounded-full flex-shrink-0"
              alt={currentUser.name}
            />
            <div className="flex-1 flex flex-col gap-2">
              <textarea
                placeholder="添加回复..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                className="w-full bg-transparent border-none outline-none text-sm resize-none min-h-[60px] placeholder:text-gray-500"
                rows={3}
              />
              <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                <label className="flex items-center gap-2 text-sm text-blue-500 hover:text-blue-600 cursor-pointer">
                  <Upload className="w-4 h-4" />
                  <span className="text-xs">{file ? file.name : '上传图片'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                  />
                </label>
                <button
                  onClick={handleSubmitComment}
                  disabled={isProcessing || (!commentText.trim() && !file)}
                  className="bg-blue-500 text-white rounded-full px-5 py-2 text-sm font-bold flex items-center gap-2 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {isProcessing ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      回复
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

export default ReplyDetailModal;
