<?php

namespace App\Services;

use Illuminate\Support\Str;

class VideoEncryptionService
{
    /**
     * Must stay a multiple of 16 (AES block size) so each non-final chunk
     * can be encrypted/decrypted with OPENSSL_ZERO_PADDING and chained
     * via IV without altering the resulting ciphertext bytes.
     */
    private const CHUNK_SIZE = 4 * 1024 * 1024;

    /**
     * Encrypt video file and save to path.
     * Streams the file in fixed-size chunks (manually chaining the CBC IV
     * between chunks) instead of loading the whole video into memory, to
     * avoid exhausting PHP's memory_limit on large files. Produces byte-
     * identical ciphertext to single-shot whole-buffer CBC encryption.
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

        $in = fopen($sourcePath, 'rb');
        if ($in === false) {
            throw new \RuntimeException('Unable to open source video for encryption');
        }
        $out = fopen($destinationPath, 'wb');
        if ($out === false) {
            fclose($in);
            throw new \RuntimeException('Unable to open destination path for encrypted video');
        }

        $iv = str_repeat('0', 16);
        $buffer = $this->readExact($in, self::CHUNK_SIZE);

        while (true) {
            $next = $this->readExact($in, self::CHUNK_SIZE);
            $isLast = $next === '';

            $options = OPENSSL_RAW_DATA | ($isLast ? 0 : OPENSSL_ZERO_PADDING);
            $encryptedChunk = openssl_encrypt($buffer, 'AES-256-CBC', $key, $options, $iv);

            if ($encryptedChunk === false) {
                fclose($in);
                fclose($out);
                throw new \RuntimeException('Video encryption failed');
            }

            fwrite($out, $encryptedChunk);
            $iv = substr($encryptedChunk, -16);

            if ($isLast) {
                break;
            }
            $buffer = $next;
        }

        fclose($in);
        fclose($out);

        clearstatcache(true, $destinationPath);
        $fileSize = filesize($destinationPath);

        return [
            'token' => $token,
            'decryption_key' => base64_encode($key),
            'file_size' => $fileSize,
        ];
    }

    /**
     * Decrypt video file to output path.
     * Mirrors encryptVideo: streams ciphertext in chunks instead of loading
     * the whole encrypted file into memory.
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

        $in = fopen($encryptedPath, 'rb');
        if ($in === false) {
            return false;
        }
        $dir = dirname($outputPath);
        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }
        $out = fopen($outputPath, 'wb');
        if ($out === false) {
            fclose($in);
            return false;
        }

        $iv = str_repeat('0', 16);
        $buffer = $this->readExact($in, self::CHUNK_SIZE);
        $ok = true;

        while (true) {
            $next = $this->readExact($in, self::CHUNK_SIZE);
            $isLast = $next === '';

            $options = OPENSSL_RAW_DATA | ($isLast ? 0 : OPENSSL_ZERO_PADDING);
            $decryptedChunk = openssl_decrypt($buffer, 'AES-256-CBC', $key, $options, $iv);

            if ($decryptedChunk === false) {
                $ok = false;
                break;
            }

            fwrite($out, $decryptedChunk);
            $iv = substr($buffer, -16);

            if ($isLast) {
                break;
            }
            $buffer = $next;
        }

        fclose($in);
        fclose($out);

        if (!$ok) {
            @unlink($outputPath);
            return false;
        }

        return true;
    }

    /**
     * Reads exactly $length bytes from $stream, or fewer only at EOF.
     * Needed because fread() may return short reads before EOF.
     * @param resource $stream
     */
    private function readExact($stream, int $length): string
    {
        $data = '';
        while (!feof($stream) && strlen($data) < $length) {
            $part = fread($stream, $length - strlen($data));
            if ($part === false || $part === '') {
                break;
            }
            $data .= $part;
        }

        return $data;
    }

    /**
     * HMAC for stream URLs (optional when request is already authenticated as download owner).
     */
    public function generateDownloadSignature(string $token, int $lessonId, int $studentId): string
    {
        $payload = $token.'|'.$lessonId.'|'.$studentId;

        return hash_hmac('sha256', $payload, (string) config('app.key'));
    }

    /**
     * Verify download link signature (token + lesson + user signed with APP_KEY).
     */
    public function verifyDownloadSignature(string $token, int $lessonId, int $studentId, ?string $signature): bool
    {
        if ($signature === null || $signature === '') {
            return false;
        }

        $expected = $this->generateDownloadSignature($token, $lessonId, $studentId);

        return hash_equals($expected, $signature);
    }
}
