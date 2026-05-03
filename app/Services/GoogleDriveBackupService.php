<?php

namespace App\Services;

use Google\Client as GoogleClient;
use Google\Service\Drive;
use Google\Service\Drive\DriveFile;
use Illuminate\Support\Facades\Log;

class GoogleDriveBackupService
{
    public function isConfigured(): bool
    {
        if (! config('backup.google_drive.enabled')) {
            return false;
        }

        $folderId = trim((string) config('backup.google_drive.folder_id'));
        $path = (string) config('backup.google_drive.credentials_path');

        return $folderId !== '' && $path !== '' && is_readable($path);
    }

    /**
     * رفع ملف النسخ الاحتياطي إلى مجلد Drive ثم الإبقاء على آخر N ملفات بنفس نمط الاسم.
     *
     * @throws \RuntimeException عند فشل الرفع (بعد التحقق من isConfigured)
     */
    public function uploadAndMaintainRetention(string $absoluteSqlPath): void
    {
        if (! is_file($absoluteSqlPath)) {
            throw new \RuntimeException('ملف النسخ الاحتياطي غير موجود للرفع.');
        }

        $credentialsPath = (string) config('backup.google_drive.credentials_path');
        $folderId = trim((string) config('backup.google_drive.folder_id'));
        $keep = max(1, (int) config('backup.google_drive.keep_files', 3));
        $supportsAllDrives = (bool) config('backup.google_drive.supports_all_drives', false);

        $client = new GoogleClient;
        $client->setAuthConfig($credentialsPath);
        $client->setScopes([Drive::DRIVE]);

        $drive = new Drive($client);

        $fileName = basename($absoluteSqlPath);
        $metadata = new DriveFile([
            'name' => $fileName,
            'parents' => [$folderId],
        ]);

        $drive->files->create($metadata, [
            'data' => file_get_contents($absoluteSqlPath) ?: '',
            'mimeType' => 'application/sql',
            'uploadType' => 'multipart',
            'supportsAllDrives' => $supportsAllDrives,
            'fields' => 'id',
        ]);

        $this->pruneRemoteBackups($drive, $folderId, $keep, $supportsAllDrives);
    }

    private function pruneRemoteBackups(Drive $drive, string $folderId, int $keep, bool $supportsAllDrives): void
    {
        $escaped = str_replace("'", "\\'", $folderId);
        $q = "'{$escaped}' in parents and trashed = false and name contains 'db-backup'";

        $response = $drive->files->listFiles([
            'q' => $q,
            'fields' => 'files(id,name,modifiedTime)',
            'orderBy' => 'modifiedTime desc',
            'pageSize' => 100,
            'supportsAllDrives' => $supportsAllDrives,
        ]);

        $files = $response->getFiles() ?? [];
        $toDelete = array_slice($files, $keep);

        foreach ($toDelete as $file) {
            $id = $file->getId();
            if (! $id) {
                continue;
            }
            try {
                $drive->files->delete($id, ['supportsAllDrives' => $supportsAllDrives]);
            } catch (\Throwable $e) {
                Log::warning('GoogleDriveBackupService: failed to delete old remote backup', [
                    'file_id' => $id,
                    'error' => $e->getMessage(),
                ]);
            }
        }
    }
}
