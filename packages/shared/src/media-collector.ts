export interface MediaData {
    data: Buffer;
    rabbitMqId: string;
    type: 'image' | 'video';
    mimeType: string;
    fileName: string;
    timestamp: string;
}

export interface ScreenshotData extends MediaData {
    type: 'image';
}

export interface VideoData extends MediaData {
    type: 'video';
}

