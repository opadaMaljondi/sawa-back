<?php

namespace App\Support;

use App\Models\Wallet;

/**
 * Wallet summary and cashier QR payload for student API responses.
 * QR value matches admin dashboard format: /students/{id}?wallet=1
 */
final class StudentWalletQr
{
    public static function walletSummary(?Wallet $wallet): array
    {
        if (! $wallet) {
            return [
                'balance' => 0.0,
                'currency' => 'SYP',
                'total_deposited' => 0.0,
                'total_spent' => 0.0,
            ];
        }

        return [
            'balance' => (float) $wallet->balance,
            'currency' => $wallet->currency ?? 'SYP',
            'total_deposited' => (float) ($wallet->total_deposited ?? 0),
            'total_spent' => (float) ($wallet->total_spent ?? 0),
        ];
    }

    /**
     * Data for encoding a QR code (same path as admin `buildStudentWalletQrUrl`).
     * Base URL must be the admin dashboard origin (not APP_URL), or the link will not hit the SPA.
     */
    public static function qrPayload(int $studentId): array
    {
        $base = rtrim((string) (self::qrBaseUrl()), '/');

        return [
            'value' => $base.'/students/'.$studentId.'?wallet=1',
            'format' => 'url',
        ];
    }

    /**
     * WALLET_QR_BASE_URL → ADMIN_DASHBOARD_URL → (local default SPA) → APP_URL
     * Avoid using APP_URL alone for QR: it is usually the API (:8000), not the admin Vite app.
     */
    public static function qrBaseUrl(): string
    {
        $explicit = config('app.wallet_qr_base_url') ?: config('app.admin_dashboard_url');
        if ($explicit) {
            return (string) $explicit;
        }

        if (config('app.env') === 'local') {
            return 'http://localhost:3000';
        }

        return (string) config('app.url');
    }
}
