<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Firebase Credentials
    |--------------------------------------------------------------------------
    | Path to the Firebase Service Account JSON file (relative to project root or absolute).
    | Example: public/firebase.json or storage/app/firebase-credentials.json
    | تحذير: لا تضع الملف في public في الإنتاج (يمكن تحميله عبر الرابط).
    */
    'credentials' => env('FIREBASE_CREDENTIALS') ? (
        str_starts_with(env('FIREBASE_CREDENTIALS'), '/')
            ? env('FIREBASE_CREDENTIALS')
            : base_path(env('FIREBASE_CREDENTIALS'))
    ) : null,

    /*
    | Realtime Database URL (e.g. https://your-project-default-rtdb.firebaseio.com)
    */
    'database_url' => env('FIREBASE_DATABASE_URL'),

    /*
    | Prefix for Realtime Database paths (e.g. "sawa" => /sawa/chats/...)
    */
    'realtime_prefix' => env('FIREBASE_REALTIME_PREFIX', 'sawa'),

    /*
    | Enable pushing new chat messages to Firebase Realtime Database for real-time listeners
    */
    'realtime_chat_enabled' => env('FIREBASE_REALTIME_CHAT_ENABLED', true),

    /*
    | Enable FCM push notifications for new messages
    */
    'fcm_enabled' => env('FIREBASE_FCM_ENABLED', true),
];
