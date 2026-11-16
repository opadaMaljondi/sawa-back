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

    /*
    |--------------------------------------------------------------------------
    | Multi-quality transcode (optional, requires ffmpeg on the server PATH)
    |--------------------------------------------------------------------------
    | After local / aws / r2 upload, queue a job that writes 360p / 720p / 1080p
    | variants next to the source file and stores paths in lessons.video_variants.
    */
    'transcode_enabled' => filter_var((string) env('VIDEO_TRANSCODE_ENABLED', 'false'), FILTER_VALIDATE_BOOLEAN),

    'transcode_qualities' => array_values(array_filter(array_map(
        'trim',
        explode(',', (string) env('VIDEO_TRANSCODE_QUALITIES', '360,720,1080'))
    ))),

    'ffmpeg_binary' => env('FFMPEG_BINARY', 'ffmpeg'),

    /*
    | Direct browser → Cloudflare R2 part size (bytes). S3/R2 require ≥ 5MB except last part.
    */
    'r2_direct_part_kb' => (int) env('VIDEO_R2_DIRECT_PART_KB', 16384),

    /*
    | Background copy of video_provider=local lessons onto R2 (scheduled command).
    */
    'migrate_local_to_r2' => filter_var((string) env('VIDEO_MIGRATE_LOCAL_TO_R2', 'true'), FILTER_VALIDATE_BOOLEAN),

];
