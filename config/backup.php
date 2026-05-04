<?php

$resolveDatabaseBackupDirectory = static function (?string $configured): string {
    $home = getenv('HOME') ?: getenv('USERPROFILE');
    $fallback = $home
        ? rtrim($home, DIRECTORY_SEPARATOR.'/\\').DIRECTORY_SEPARATOR.'backup'
        : storage_path('app/backup');

    if ($configured === null || trim($configured) === '') {
        return $fallback;
    }

    $path = trim($configured);
    if (str_starts_with($path, '~/')) {
        if (! $home) {
            return $fallback;
        }

        return rtrim($home, DIRECTORY_SEPARATOR.'/\\').DIRECTORY_SEPARATOR.substr($path, 2);
    }

    return $path;
};

return [

    /*
    |--------------------------------------------------------------------------
    | Database dump directory
    |--------------------------------------------------------------------------
    |
    | الافتراضي: مجلد backup داخل المجلد الرئيسي للمستخدم (~ / %USERPROFILE%).
    | يمكن تجاوزه بـ DB_BACKUP_DIRECTORY (مسار مطلق أو يبدأ بـ ~/).
    |
    */
    'database_directory' => $resolveDatabaseBackupDirectory(env('DB_BACKUP_DIRECTORY')),

    /*
    |--------------------------------------------------------------------------
    | عدد النسخ المحفوظة
    |--------------------------------------------------------------------------
    */
    'keep_database_files' => (int) env('DB_BACKUP_KEEP', 3),

    /*
    |--------------------------------------------------------------------------
    | مسار mysqldump (اختياري)
    |--------------------------------------------------------------------------
    |
    | على Windows قد تحتاج المسار الكامل، مثال: C:\xampp\mysql\bin\mysqldump.exe
    |
    */
    'mysqldump_path' => env('MYSQLDUMP_PATH', 'mysqldump'),

    /*
    |--------------------------------------------------------------------------
    | Google Drive (رفع النسخ الاحتياطية)
    |--------------------------------------------------------------------------
    |
    | auth=oauth (افتراضي): YOUTUBE_CLIENT_* + ملف youtube-token.json بعد منح نطاق drive.file
    |   (أعد زيارة /youtube/auth). GOOGLE_DRIVE_FOLDER_ID = مجلد في حسابك على Drive.
    |
    | auth=service_account: JSON + Workspace/Shared Drive عادةً.
    |
    */
    'google_drive' => [
        'enabled' => filter_var((string) env('DB_BACKUP_UPLOAD_TO_GOOGLE_DRIVE', 'false'), FILTER_VALIDATE_BOOLEAN),
        'auth' => env('GOOGLE_DRIVE_AUTH', 'oauth'),
        'oauth_token_path' => env('GOOGLE_DRIVE_OAUTH_TOKEN_PATH', storage_path('app/youtube-token.json')),
        'credentials_path' => env('GOOGLE_DRIVE_CREDENTIALS_PATH', storage_path('app/google-drive-service-account.json')),
        'folder_id' => env('GOOGLE_DRIVE_FOLDER_ID', ''),
        'keep_files' => (int) env('DB_BACKUP_GOOGLE_DRIVE_KEEP', 3),
        'supports_all_drives' => filter_var((string) env('GOOGLE_DRIVE_SUPPORTS_ALL_DRIVES', 'false'), FILTER_VALIDATE_BOOLEAN),
    ],

];
