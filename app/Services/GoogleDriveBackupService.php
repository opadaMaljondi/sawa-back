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
        if ($folderId === '') {
            return false;
        }

        $auth = strtolower((string) config('backup.google_drive.auth', 'oauth'));

        if ($auth === 'service_account') {
            $path = (string) config('backup.google_drive.credentials_path');

            return $path !== '' && is_readable($path);
        }

        $tokenPath = (string) config('backup.google_drive.oauth_token_path');

        return $tokenPath !== ''
            && is_readable($tokenPath)
            && filled(config('youtube.client_id'))
            && filled(config('youtube.client_secret'));
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

        $folderId = trim((string) config('backup.google_drive.folder_id'));
        $keep = max(1, (int) config('backup.google_drive.keep_files', 3));
        $supportsAllDrives = (bool) config('backup.google_drive.supports_all_drives', false);

        $client = $this->buildGoogleClient();
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

    private function buildGoogleClient(): GoogleClient
    {
        $auth = strtolower((string) config('backup.google_drive.auth', 'oauth'));

        if ($auth === 'service_account') {
            $credentialsPath = (string) config('backup.google_drive.credentials_path');
            $client = new GoogleClient;
            $client->setAuthConfig($credentialsPath);
            $client->setScopes([Drive::DRIVE]);

            return $client;
        }

        return $this->buildOAuthClientFromYouTubeToken();
    }

    private function buildOAuthClientFromYouTubeToken(): GoogleClient
    {
        $tokenPath = (string) config('backup.google_drive.oauth_token_path');
        if (! is_readable($tokenPath)) {
            throw new \RuntimeException('ملف OAuth غير موجود أو غير قابل للقراءة: '.$tokenPath);
        }

        $client = new GoogleClient;
        $client->setClientId((string) config('youtube.client_id'));
        $client->setClientSecret((string) config('youtube.client_secret'));
        $client->setRedirectUri((string) config('youtube.redirect_uri'));
        $client->setScopes(config('youtube.scopes'));
        $client->setAccessType('offline');
        $client->setPrompt('consent');

        $previousToken = json_decode((string) file_get_contents($tokenPath), true);
        if (! is_array($previousToken)) {
            throw new \RuntimeException('ملف التوكن غير صالح (JSON).');
        }

        $client->setAccessToken($previousToken);

        if ($client->isAccessTokenExpired()) {
            $refresh = $client->getRefreshToken();
            if (! $refresh) {
                throw new \RuntimeException('انتهت صلاحية التوكن ولا يوجد refresh_token. أعد التفويض من: '.YouTubeService::oauthAuthorizeUrl());
            }
            $client->fetchAccessTokenWithRefreshToken($refresh);
            YouTubeService::persistAccessToken($tokenPath, $client, $previousToken);
        }

        return $client;
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
