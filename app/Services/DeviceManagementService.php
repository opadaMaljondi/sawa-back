<?php

namespace App\Services;

use App\Models\Device;
use Illuminate\Support\Str;

class DeviceManagementService
{
    /** أقصى عدد أجهزة مسموح للمستخدم (null = بدون حد). */
    protected ?int $maxDevicesPerUser = null;

    /**
     * تسجيل الجهاز أو تحديثه (بما فيه FCM token).
     * يُستدعى عند تسجيل الدخول أو عند تحديث الـ token من التطبيق.
     *
     * @param array{device_id: string, device_name?: string, device_type?: string, os?: string, app_version?: string, fcm_token?: string} $data
     */
    public function registerDevice(int $userId, array $data): Device
    {
        $deviceId = $data['device_id'] ?? null;
        if (empty($deviceId)) {
            throw new \InvalidArgumentException('device_id is required.');
        }

        if ($this->maxDevicesPerUser !== null) {
            $currentCount = Device::where('user_id', $userId)->count();
            $existing = Device::where('user_id', $userId)->where('device_id', $deviceId)->first();
            if (!$existing && $currentCount >= $this->maxDevicesPerUser) {
                throw new \RuntimeException('تم الوصول إلى الحد الأقصى لعدد الأجهزة المسجلة.');
            }
        }

        $device = Device::updateOrCreate(
            [
                'user_id' => $userId,
                'device_id' => $deviceId,
            ],
            [
                'device_name' => $data['device_name'] ?? null,
                'device_type' => $data['device_type'] ?? 'mobile',
                'os' => $data['os'] ?? null,
                'app_version' => $data['app_version'] ?? null,
                'fcm_token' => $data['fcm_token'] ?? null,
                'active' => true,
                'last_used_at' => now(),
            ]
        );

        return $device;
    }

    /**
     * تحديث FCM token فقط (عند تجدّد الـ token من التطبيق).
     */
    public function updateFcmToken(int $userId, string $deviceId, ?string $fcmToken): ?Device
    {
        $device = Device::where('user_id', $userId)->where('device_id', $deviceId)->first();
        if (!$device) {
            return null;
        }
        $device->update([
            'fcm_token' => $fcmToken,
            'last_used_at' => now(),
        ]);
        return $device;
    }

    /**
     * إلغاء تفعيل جهاز (تسجيل خروج من الجهاز).
     */
    public function deactivateDevice(int $userId, string $deviceId): bool
    {
        return Device::where('user_id', $userId)
            ->where('device_id', $deviceId)
            ->update(['active' => false]) > 0;
    }
}
