<?php

return [
    'client_id' => env('YOUTUBE_CLIENT_ID'),
    'client_secret' => env('YOUTUBE_CLIENT_SECRET'),
    'redirect_uri' => env('YOUTUBE_REDIRECT_URI'),
    'api_key' => env('YOUTUBE_API_KEY'),
    'channel_id' => env('YOUTUBE_CHANNEL_ID'),

    'scopes' => [
        'https://www.googleapis.com/auth/youtube.upload',
        'https://www.googleapis.com/auth/youtube.readonly',
        'https://www.googleapis.com/auth/youtube.force-ssl',
    ],

    'upload_settings' => [
        'privacy_status' => 'unlisted', // 'public', 'private', 'unlisted'
        'category_id' => '27', // Education category
        'default_language' => 'ar',
        'default_tags' => ['education', 'courses', 'online-learning'],
    ],

    'download_settings' => [
        'allowed_qualities' => ['360p', '480p', '720p'],
        'encryption_enabled' => true,
        'max_file_size' => 500, // MB
    ],
];
