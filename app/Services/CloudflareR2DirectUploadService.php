<?php

namespace App\Services;

use Aws\S3\S3Client;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;
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
        $disk = Storage::disk('r2');
        if (! method_exists($disk, 'getAdapter')) {
            throw new \RuntimeException('R2 disk adapter is unavailable.');
        }
        $adapter = $disk->getAdapter();
        if (! is_object($adapter) || ! method_exists($adapter, 'getClient')) {
            throw new \RuntimeException('R2 is not configured as an S3-compatible disk. Check R2_ENDPOINT and keys.');
        }
        $client = $adapter->getClient();
        if (! $client instanceof S3Client) {
            throw new \RuntimeException('R2 S3 client missing.');
        }

        return $client;
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
