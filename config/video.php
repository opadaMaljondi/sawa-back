<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Chunked admin video upload (local / S3)
    |--------------------------------------------------------------------------
    | Each chunk must be under PHP upload_max_filesize / post_max_size.
    | Smaller chunks = more requests but safer defaults (e.g. 8MB PHP limit).
    */
    'chunk_max_kb' => (int) env('VIDEO_CHUNK_MAX_KB', 5120),

    'max_video_kb' => (int) env('VIDEO_MAX_KB', 512000),

];
