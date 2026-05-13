<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Chunked admin video upload (local / S3)
    |--------------------------------------------------------------------------
    | Each chunk must be under PHP upload_max_filesize / post_max_size.
    | Smaller chunks = more requests but safer defaults (e.g. 8MB PHP limit).
    | Larger chunks reduce HTTP round-trips (faster on typical latency). Match PHP post limits.
    */
    'chunk_max_kb' => (int) env('VIDEO_CHUNK_MAX_KB', 32768),

    'max_video_kb' => (int) env('VIDEO_MAX_KB', 512000),

    /*
    | On Linux production hosts, merging many parts with `cat` is faster than PHP streams.
    | Disabled by default for predictable behavior in dev / Windows.
    */
    'merge_chunks_via_shell' => filter_var((string) env('VIDEO_MERGE_CHUNKS_VIA_SHELL', 'false'), FILTER_VALIDATE_BOOLEAN),

];
