<?php

namespace App\Services;

use Aws\Exception\MultipartUploadException;
use Aws\S3\MultipartUploader;
use Aws\S3\S3Client;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

/**
 * Browser → Cloudflare R2 multipart (presigned PUT parts). File never streams through PHP.
 */
class CloudflareR2DirectUploadService
{
    public const CACHE_PREFIX = 'r2_direct:';

    public function cacheKey(string $sessionId): string
    {
        return self::CACHE_PREFIX.$sessionId;
    }

    /**
     * @return array<string, mixed>
     */
    public function getSession(string $sessionId): ?array
    {
        $data = Cache::get($this->cacheKey($sessionId));

        return is_array($data) ? $data : null;
    }

    public function putSession(string $sessionId, array $data): void
    {
        Cache::put($this->cacheKey($sessionId), $data, now()->addDay());
    }

    public function forgetSession(string $sessionId): void
    {
        Cache::forget($this->cacheKey($sessionId));
    }

    public function client(): S3Client
    {
        $cfg = config('filesystems.disks.r2', []);
        $key = trim((string) ($cfg['key'] ?? ''));
        $secret = trim((string) ($cfg['secret'] ?? ''));
        $endpoint = rtrim(trim((string) ($cfg['endpoint'] ?? '')), '/');
        if (str_ends_with($endpoint, '/'.(string) ($cfg['bucket'] ?? ''))) {
            $endpoint = substr($endpoint, 0, -strlen('/'.(string) $cfg['bucket']));
        }
        if ($key === '' || $secret === '' || $endpoint === '') {
            throw new \RuntimeException('R2 is not configured. Set R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_ENDPOINT in .env then run php artisan config:clear.');
        }

        $s3Config = [
            'version' => 'latest',
            'region' => (string) ($cfg['region'] ?? 'auto'),
            'endpoint' => $endpoint,
            'use_path_style_endpoint' => (bool) ($cfg['use_path_style_endpoint'] ?? false),
            'credentials' => [
                'key' => $key,
                'secret' => $secret,
            ],
        ];
        $clientArgs = S3Client::getArguments();
        if (isset($clientArgs['request_checksum_calculation'])) {
            $s3Config['request_checksum_calculation'] = 'when_required';
            $s3Config['response_checksum_validation'] = 'when_required';
        }

        return new S3Client($s3Config);
    }

    public function objectSize(string $key): ?int
    {
        try {
            $res = $this->client()->headObject([
                'Bucket' => $this->bucket(),
                'Key' => $key,
            ]);

            return isset($res['ContentLength']) ? (int) $res['ContentLength'] : 0;
        } catch (\Throwable) {
            return null;
        }
    }

    /**
     * Server-side copy of a local file to R2 without Flysystem ACLs (R2 rejects ACL headers).
     */
    public function uploadFromPath(string $key, string $absolutePath): void
    {
        if (! is_file($absolutePath) || ! is_readable($absolutePath)) {
            throw new \RuntimeException("Local video is not readable: {$absolutePath}");
        }

        $size = filesize($absolutePath);
        $existing = $this->objectSize($key);
        if ($existing !== null && is_int($size) && $size > 0 && $existing === $size) {
            return;
        }

        $contentType = match (strtolower((string) pathinfo($absolutePath, PATHINFO_EXTENSION))) {
            'mov' => 'video/quicktime',
            'avi' => 'video/x-msvideo',
            default => 'video/mp4',
        };

        $client = $this->client();
        $bucket = $this->bucket();
        $params = [
            'ContentType' => $contentType,
        ];

        try {
            if (is_int($size) && $size > 0 && $size < 8 * 1024 * 1024) {
                $client->putObject([
                    'Bucket' => $bucket,
                    'Key' => $key,
                    'SourceFile' => $absolutePath,
                    'ContentType' => $contentType,
                ]);

                return;
            }

            $uploader = new MultipartUploader($client, $absolutePath, [
                'bucket' => $bucket,
                'key' => $key,
                'part_size' => 16 * 1024 * 1024,
                'concurrency' => 2,
                'params' => $params,
            ]);
            $uploader->upload();
        } catch (MultipartUploadException $e) {
            throw new \RuntimeException('R2 multipart upload failed: '.$e->getMessage(), 0, $e);
        } catch (\Throwable $e) {
            throw new \RuntimeException('R2 upload failed: '.$e->getMessage(), 0, $e);
        }
    }

    public function bucket(): string
    {
        $bucket = (string) config('filesystems.disks.r2.bucket');
        if ($bucket === '') {
            throw new \RuntimeException('R2_BUCKET is not set.');
        }

        return $bucket;
    }

    /**
     * @return array{session_id: string, key: string, mode: string, total_parts: int, part_urls: array<int, string>}
     */
    public function initiate(int $courseId, string $originalName, int $fileSize, int $partSizeBytes): array
    {
        $ext = strtolower((string) pathinfo($originalName, PATHINFO_EXTENSION));
        if (! in_array($ext, ['mp4', 'avi', 'mov'], true)) {
            throw new \RuntimeException('Invalid video type. Allowed: mp4, avi, mov.');
        }

        $partSizeBytes = max(5 * 1024 * 1024, $partSizeBytes);
        $totalParts = max(1, (int) ceil($fileSize / $partSizeBytes));
        if ($totalParts > 10000) {
            throw new \RuntimeException('File too large for multipart upload (too many parts).');
        }

        $key = 'videos/lessons/course_'.$courseId.'/'.Str::random(40).'.'.$ext;
        $contentType = $ext === 'mov' ? 'video/quicktime' : 'video/mp4';
        $sessionId = (string) Str::uuid();
        $client = $this->client();
        $bucket = $this->bucket();

        $mode = $totalParts === 1 ? 'put' : 'multipart';
        $s3UploadId = null;
        $partUrls = [];

        if ($mode === 'put') {
            $cmd = $client->getCommand('PutObject', [
                'Bucket' => $bucket,
                'Key' => $key,
                'ContentType' => $contentType,
            ]);
            $partUrls[1] = (string) $client->createPresignedRequest($cmd, '+6 hours')->getUri();
        } else {
            $created = $client->createMultipartUpload([
                'Bucket' => $bucket,
                'Key' => $key,
                'ContentType' => $contentType,
            ]);
            $s3UploadId = (string) ($created['UploadId'] ?? '');
            if ($s3UploadId === '') {
                throw new \RuntimeException('R2 did not return a multipart UploadId.');
            }
            $partUrls = $this->presignPartNumbers($key, $s3UploadId, range(1, min(40, $totalParts)));
        }

        $this->putSession($sessionId, [
            'course_id' => $courseId,
            'key' => $key,
            'mode' => $mode,
            's3_upload_id' => $s3UploadId,
            'original_name' => $originalName,
            'content_type' => $contentType,
            'file_size' => $fileSize,
            'part_size' => $partSizeBytes,
            'total_parts' => $totalParts,
        ]);

        return [
            'session_id' => $sessionId,
            'key' => $key,
            'mode' => $mode,
            'total_parts' => $totalParts,
            'part_size' => $partSizeBytes,
            'part_urls' => $partUrls,
        ];
    }

    /**
     * @param  list<int>  $partNumbers  1-based
     * @return array<int, string> partNumber => url
     */
    public function presignPartNumbers(string $key, string $s3UploadId, array $partNumbers): array
    {
        $client = $this->client();
        $bucket = $this->bucket();
        $urls = [];
        foreach ($partNumbers as $n) {
            $n = (int) $n;
            if ($n < 1) {
                continue;
            }
            $cmd = $client->getCommand('UploadPart', [
                'Bucket' => $bucket,
                'Key' => $key,
                'UploadId' => $s3UploadId,
                'PartNumber' => $n,
            ]);
            $urls[$n] = (string) $client->createPresignedRequest($cmd, '+6 hours')->getUri();
        }

        return $urls;
    }

    /**
     * @return list<int> 0-based indices of completed parts
     */
    public function completedZeroBasedIndices(array $session): array
    {
        if (($session['mode'] ?? '') !== 'multipart' || empty($session['s3_upload_id'])) {
            return [];
        }
        $client = $this->client();
        $parts = [];
        $marker = null;
        do {
            $args = [
                'Bucket' => $this->bucket(),
                'Key' => $session['key'],
                'UploadId' => $session['s3_upload_id'],
            ];
            if ($marker) {
                $args['PartNumberMarker'] = $marker;
            }
            $res = $client->listParts($args);
            foreach ($res['Parts'] ?? [] as $p) {
                $num = (int) ($p['PartNumber'] ?? 0);
                if ($num >= 1) {
                    $parts[] = $num - 1;
                }
            }
            $marker = $res['IsTruncated'] ?? false ? ($res['NextPartNumberMarker'] ?? null) : null;
        } while ($marker);

        return array_values(array_unique($parts));
    }

    /**
     * @param  list<array{part_number: int, etag: string}>  $parts
     */
    public function completeMultipart(array $session, array $parts): void
    {
        if (($session['mode'] ?? '') === 'put') {
            return;
        }
        usort($parts, fn ($a, $b) => ((int) $a['part_number']) <=> ((int) $b['part_number']));
        $mapped = [];
        foreach ($parts as $p) {
            $etag = trim((string) ($p['etag'] ?? ''), " \t\n\r\0\x0B\"");
            if ($etag === '') {
                throw new \RuntimeException('Missing ETag for part '.$p['part_number']);
            }
            $mapped[] = [
                'ETag' => '"'.$etag.'"',
                'PartNumber' => (int) $p['part_number'],
            ];
        }
        $this->client()->completeMultipartUpload([
            'Bucket' => $this->bucket(),
            'Key' => $session['key'],
            'UploadId' => $session['s3_upload_id'],
            'MultipartUpload' => ['Parts' => $mapped],
        ]);
    }

    public function abort(array $session): void
    {
        if (($session['mode'] ?? '') !== 'multipart' || empty($session['s3_upload_id'])) {
            return;
        }
        try {
            $this->client()->abortMultipartUpload([
                'Bucket' => $this->bucket(),
                'Key' => $session['key'],
                'UploadId' => $session['s3_upload_id'],
            ]);
        } catch (\Throwable) {
            /* ignore */
        }
    }
}
