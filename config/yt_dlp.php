<?php

return [
    /*
    |--------------------------------------------------------------------------
    | yt-dlp binary
    |--------------------------------------------------------------------------
    |
    | Full path to yt-dlp executable (or just "yt-dlp" if it is in PATH).
    | Windows example: C:\tools\yt-dlp.exe
    |
    */
    'bin' => env('YT_DLP_BIN', 'yt-dlp'),

    /*
    |--------------------------------------------------------------------------
    | Default format selector
    |--------------------------------------------------------------------------
    |
    | Keep it simple: prefer a single progressive MP4 when available.
    | If not available, yt-dlp will fall back to the best it can find.
    |
    */
    'format' => env('YT_DLP_FORMAT', 'best[ext=mp4]/best'),

    /*
    |--------------------------------------------------------------------------
    | Optional cookies file (for restricted videos)
    |--------------------------------------------------------------------------
    */
    'cookies' => env('YT_DLP_COOKIES', null),

    /*
    |--------------------------------------------------------------------------
    | Optional browser cookies source
    |--------------------------------------------------------------------------
    |
    | Example values:
    | chrome
    | firefox
    | brave
    |
    | When set, yt-dlp will use --cookies-from-browser=<value>.
    |
    */
    'cookies_from_browser' => env('YT_DLP_COOKIES_FROM_BROWSER', null),

    /*
    |--------------------------------------------------------------------------
    | Process timeout (seconds)
    |--------------------------------------------------------------------------
    */
    'timeout' => (int) env('YT_DLP_TIMEOUT', 90),
];

