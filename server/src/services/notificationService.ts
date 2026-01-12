import { Transaction, TransactionType, OTCState, Currency } from '../types.js';
import { NotificationRepository } from '../db/repositories/notificationRepository.js';
import { UserRepository } from '../db/repositories/userRepository.js';

export enum NotificationType {
  REQUEST_CREATED = 'REQUEST_CREATED',
  REQUEST_STATE_CHANGED = 'REQUEST_STATE_CHANGED',
  PAYMENT_RECEIVED = 'PAYMENT_RECEIVED',
}

/**
 * 通知服务
 */
export class NotificationService {
  /**
   * 通知：Request 交易创建
   * 当有人创建 Request 时，通知目标用户（如果有 toUser）
   */
  static async notifyRequestCreated(transaction: Transaction): Promise<void> {
    try {
      // 如果是 REQUEST 类型且有目标用户
      if (transaction.type === TransactionType.REQUEST && transaction.toUser) {
        const fromUser = transaction.fromUser;
        const toUser = transaction.toUser;
        
        const title = '新的支付请求';
        const message = `${fromUser.name} (${fromUser.handle}) 向你请求 ${transaction.amount} ${transaction.currency}${transaction.isOTC ? ` (OTC: ${transaction.otcOfferAmount} ${transaction.otcFiatCurrency})` : ''}`;
        
        await NotificationRepository.create({
          userId: toUser.id,
          type: NotificationType.REQUEST_CREATED,
          title,
          message,
          transactionId: transaction.id,
          relatedUserId: fromUser.id,
          isRead: false,
        });
        
        console.log(`📬 Notification sent: Request created to ${toUser.handle}`);
      }
    } catch (error) {
      console.error('Failed to send request created notification:', error);
    }
  }

  /**
   * 通知：Request 状态变化
   * 当 Request 状态改变时，通知相关用户
   */
  static async notifyRequestStateChanged(
    transaction: Transaction,
    oldState: OTCState,
    newState: OTCState
  ): Promise<void> {
    try {
      // 只处理 REQUEST 类型的交易
      if (transaction.type !== TransactionType.REQUEST) {
        return;
      }

      const fromUser = transaction.fromUser;
      const toUser = transaction.toUser;

      // 状态变化消息映射
      const stateMessages: Record<string, string> = {
        [OTCState.OPEN_REQUEST]: '请求已开放',
        [OTCState.AWAITING_FIAT_PAYMENT]: '等待法币支付',
        [OTCState.AWAITING_FIAT_CONFIRMATION]: '等待法币确认',
        [OTCState.COMPLETED]: '交易已完成',
        [OTCState.FAILED]: '交易已失败',
      };

      const stateMessage = stateMessages[newState] || '状态已更新';
      const title = '请求状态更新';
      
      // 通知发起人（fromUser）
      if (fromUser) {
        const message = `你的请求状态已更新：${stateMessage}${toUser ? ` (与 ${toUser.name} 的交易)` : ''}`;
        
        await NotificationRepository.create({
          userId: fromUser.id,
          type: NotificationType.REQUEST_STATE_CHANGED,
          title,
          message,
          transactionId: transaction.id,
          relatedUserId: toUser?.id,
          isRead: false,
        });
      }

      // 通知目标用户（toUser）
      if (toUser) {
        const message = `${fromUser.name} 的请求状态已更新：${stateMessage}`;
        
        await NotificationRepository.create({
          userId: toUser.id,
          type: NotificationType.REQUEST_STATE_CHANGED,
          title,
          message,
          transactionId: transaction.id,
          relatedUserId: fromUser.id,
          isRead: false,
        });
      }

      console.log(`📬 Notification sent: Request state changed from ${oldState} to ${newState}`);
    } catch (error) {
      console.error('Failed to send request state changed notification:', error);
    }
  }

  /**
   * 通知：收到加密货币支付
   * 当收到 USDT 等加密货币支付时，通知收款人
   */
  static async notifyPaymentReceived(transaction: Transaction): Promise<void> {
    try {
      // 只处理 PAYMENT 类型且有收款人的交易
      if (transaction.type === TransactionType.PAYMENT && transaction.toUser) {
        const fromUser = transaction.fromUser;
        const toUser = transaction.toUser;
        
        // 只通知加密货币支付（USDT）
        if (transaction.currency === Currency.USDT) {
          const title = '收到加密货币支付';
          const message = `${fromUser.name} (${fromUser.handle}) 向你支付了 ${transaction.amount} ${transaction.currency}`;
          
          await NotificationRepository.create({
            userId: toUser.id,
            type: NotificationType.PAYMENT_RECEIVED,
            title,
            message,
            transactionId: transaction.id,
            relatedUserId: fromUser.id,
            isRead: false,
          });
          
          console.log(`📬 Notification sent: Payment received by ${toUser.handle}`);
        }
      }
    } catch (error) {
      console.error('Failed to send payment received notification:', error);
    }
  }

  /**
   * 通知：USDT 已存入多签合约
   * 当 Request 发起者将 USDT 存入多签合约后，通知被选中的交易者
   */
  static async notifyUSDTInEscrow(transaction: Transaction): Promise<void> {
    try {
      // 只处理 REQUEST 类型且有选中交易者的 OTC 交易
      if (transaction.type !== TransactionType.REQUEST || !transaction.isOTC || !transaction.selectedTraderId) {
        return;
      }

      // 获取被选中的交易者信息
      const selectedTrader = await UserRepository.findById(transaction.selectedTraderId);
      if (!selectedTrader) {
        console.error(`Selected trader not found: ${transaction.selectedTraderId}`);
        return;
      }

      const fromUser = transaction.fromUser;
      const title = 'USDT 已多签支付，请进行法币支付';
      const message = `${fromUser.name} (${fromUser.handle}) 已将 ${transaction.amount} ${transaction.currency} 存入多签合约。请进行法币支付并上传凭证，然后对多签交易进行签名。`;

      await NotificationRepository.create({
        userId: selectedTrader.id,
        type: NotificationType.REQUEST_STATE_CHANGED,
        title,
        message,
        transactionId: transaction.id,
        relatedUserId: fromUser.id,
        isRead: false,
      });

      console.log(`📬 Notification sent: USDT in escrow to selected trader ${selectedTrader.handle}`);
    } catch (error) {
      console.error('Failed to send USDT in escrow notification:', error);
    }
  }

  /**
   * 通知：发起者申请退回资产
   * 当 Request 发起者申请退回资产（两次未收到法币）后，通知交易者
   */
  static async notifyRefundRequested(transaction: Transaction): Promise<void> {
    try {
      // 只处理 REQUEST 类型且有选中交易者的 OTC 交易
      if (transaction.type !== TransactionType.REQUEST || !transaction.isOTC || !transaction.selectedTraderId) {
        return;
      }

      // 获取被选中的交易者信息
      const selectedTrader = await UserRepository.findById(transaction.selectedTraderId);
      if (!selectedTrader) {
        console.error(`Selected trader not found: ${transaction.selectedTraderId}`);
        return;
      }

      const fromUser = transaction.fromUser;
      const title = '发起者申请退回资产';
      const message = `${fromUser.name} (${fromUser.handle}) 已两次声称未收到法币，已发起资产退回请求。请同意签名以完成退款，USDT 将返回到发起者账户。`;

      await NotificationRepository.create({
        userId: selectedTrader.id,
        type: NotificationType.REQUEST_STATE_CHANGED,
        title,
        message,
        transactionId: transaction.id,
        relatedUserId: fromUser.id,
        isRead: false,
      });

      console.log(`📬 Notification sent: Refund requested to selected trader ${selectedTrader.handle}`);
    } catch (error) {
      console.error('Failed to send refund requested notification:', error);
    }
  }
}
