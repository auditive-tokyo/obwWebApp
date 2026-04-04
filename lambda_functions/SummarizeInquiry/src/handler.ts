import { Handler } from 'aws-lambda';

// 環境変数（既存のnotify_adminと同じ）
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';
const TELEGRAM_TOPIC_ID_EMERGENCY = process.env.TELEGRAM_TOPIC_ID_EMERGENCY || '';

// ユーザー情報の型定義
interface UserInfo {
    representativeName?: string;
    representativeEmail?: string;
    representativePhone?: string;
    currentLocation?: string;
}

// イベントの型定義
interface TelegramNotificationEvent {
    roomId: string;
    inquirySummary: string;
    userInfo?: UserInfo;
    timestamp: string;
}

/**
 * Telegram APIにメッセージを送信
 */
async function sendTelegram(text: string, topicID?: string): Promise<void> {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
        throw new Error('TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is not set');
    }

    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    
    const params: Record<string, string> = {
        chat_id: TELEGRAM_CHAT_ID,
        text: text,
        disable_web_page_preview: 'true',
        parse_mode: 'Markdown'  // Markdownフォーマット有効化
    };
    if (topicID) {
        params.message_thread_id = topicID;
    }
    const body = new URLSearchParams(params);

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: body.toString(),
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Telegram API error: ${response.status} ${errorBody}`);
        }

        console.info('✅ Telegram message sent successfully');
    } catch (error) {
        console.error('❌ Failed to send Telegram message:', error);
        throw error;
    }
}

/**
 * Lambda handler
 */
export const handler: Handler<TelegramNotificationEvent, { success: boolean }> = async (event: TelegramNotificationEvent) => {
    const userInfo = event.userInfo || {};
    
    console.info('🚨 Human operator notification received:', {
        roomId: event.roomId,
        timestamp: event.timestamp,
        hasUserInfo: !!event.userInfo,
        hasLocation: !!userInfo.currentLocation
    });

    try {
        // Telegramメッセージを構築
        const lines = [
            '🚨 *緊急: オペレーター支援が必要*',
            '',
            `*部屋番号:* ${event.roomId}`,
            `*発生日時:* ${new Date(event.timestamp).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}`,
            '',
            '*問い合わせサマリー:*',
            event.inquirySummary,
        ];

        // お客様情報を追加
        if (userInfo.representativeName || userInfo.representativeEmail || userInfo.representativePhone || userInfo.currentLocation) {
            lines.push('', '*お客様情報:*');
            if (userInfo.representativeName) lines.push(`- お名前: ${userInfo.representativeName}`);
            if (userInfo.representativePhone) lines.push(`- 電話番号: ${userInfo.representativePhone}`);
            if (userInfo.representativeEmail) lines.push(`- Email: ${userInfo.representativeEmail}`);
            if (userInfo.currentLocation) lines.push(`- 現在位置: ${userInfo.currentLocation}`);
        }

        const messageText = lines.join('\n');

        // Telegram送信（Emergencyトピックへ）
        await sendTelegram(messageText, TELEGRAM_TOPIC_ID_EMERGENCY);

        console.info('✅ Notification processed successfully');
        return { success: true };

    } catch (error) {
        console.error('❌ Error processing notification:', error);
        throw error;  // Lambda実行失敗として扱う（再試行される）
    }
};