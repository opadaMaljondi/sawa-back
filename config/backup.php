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

];
