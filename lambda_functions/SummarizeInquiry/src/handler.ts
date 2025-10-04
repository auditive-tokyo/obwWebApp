import { Handler, Context } from 'aws-lambda';

// 環境変数（既存のnotify_adminと同じ）
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';

// イベントの型定義
interface TelegramNotificationEvent {
    roomId: string;
    userMessage: string;
    inquirySummary: string;
    currentLocation?: string;
    timestamp: string;
}

/**
 * Telegram APIにメッセージを送信
 */
async function sendTelegram(text: string): Promise<void> {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
        throw new Error('TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is not set');
    }

    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    
    const body = new URLSearchParams({
        chat_id: TELEGRAM_CHAT_ID,
        text: text,
        disable_web_page_preview: 'true',
        parse_mode: 'Markdown'  // Markdownフォーマット有効化
    });

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
export const handler: Handler<TelegramNotificationEvent, { success: boolean }> = async (event: TelegramNotificationEvent, context: Context) => {
    console.info('🚨 Human operator notification received:', {
        roomId: event.roomId,
        timestamp: event.timestamp,
        hasLocation: !!event.currentLocation
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
            '',
            '*ユーザーの元メッセージ:*',
            `"${event.userMessage}"`,
        ];

        // 位置情報があれば追加
        if (event.currentLocation) {
            lines.push('', `*現在位置:* ${event.currentLocation}`);
        }

        const messageText = lines.join('\n');

        // Telegram送信
        await sendTelegram(messageText);

        console.info('✅ Notification processed successfully');
        return { success: true };

    } catch (error) {
        console.error('❌ Error processing notification:', error);
        throw error;  // Lambda実行失敗として扱う（再試行される）
    }
};