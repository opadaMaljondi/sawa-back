<?php

namespace App\Services;

use Illuminate\Support\Str;

class VideoEncryptionService
{
    /**
     * Encrypt video file and save to path.
     * @return array{token: string, decryption_key: string, file_size: int}
     */
    public function encryptVideo(string $sourcePath, string $destinationPath): array
    {
        $key = Str::random(32);
        $token = Str::random(64);
        $dir = dirname($destinationPath);
        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }
        $content = file_get_contents($sourcePath);
        $encrypted = openssl_encrypt(
            $content,
            'AES-256-CBC',
            $key,
            OPENSSL_RAW_DATA,
            str_repeat('0', 16)
        );
        if ($encrypted === false) {
            throw new \RuntimeException('Video encryption failed');
        }
        file_put_contents($destinationPath, $encrypted);
        $fileSize = filesize($destinationPath);
        return [
            'token' => $token,
            'decryption_key' => base64_encode($key),
            'file_size' => $fileSize,
        ];
    }

    /**
     * Decrypt video file to output path.
     */
    public function decryptVideo(string $encryptedPath, string $encryptionKey, string $outputPath): bool
    {
        if (!file_exists($encryptedPath)) {
            return false;
        }
        $key = base64_decode($encryptionKey, true);
        if ($key === false || strlen($key) !== 32) {
            return false;
        }
        $encrypted = file_get_contents($encryptedPath);
        $decrypted = openssl_decrypt(
            $encrypted,
            'AES-256-CBC',
            $key,
            OPENSSL_RAW_DATA,
            str_repeat('0', 16)
        );
        if ($decrypted === false) {
            return false;
        }
        $dir = dirname($outputPath);
        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }
        file_put_contents($outputPath, $decrypted);
        return true;
    }

    /**
     * Verify download link signature (e.g. token + lesson + user signed).
     */
    public function verifyDownloadSignature(string $token, int $lessonId, int $studentId, ?string $signature): bool
    {
        if ($signature === null || $signature === '') {
            return false;
        }
        $payload = $token . '|' . $lessonId . '|' . $studentId;
        $expected = hash_hmac('sha256', $payload, config('app.key'));
        return hash_equals($expected, $signature);
    }
}
