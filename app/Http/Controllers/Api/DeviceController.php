<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\DeviceManagementService;
use Illuminate\Http\Request;

/**
 * تسجيل/تحديث الجهاز و FCM token لأي مستخدم مسجّل دخوله (طالب، معلم، إلخ).
 */
class DeviceController extends Controller
{
    /**
     * تسجيل الجهاز أو تحديث بياناته (بما فيها FCM token للإشعارات).
     *
     * POST /api/devices/register
     * Body: device_id, device_name?, device_type?, os?, app_version?, fcm_token?
     */
    public function register(Request $request, DeviceManagementService $deviceService)
    {
        $request->validate([
            'device_id' => 'required|string|max:255',
            'device_name' => 'nullable|string|max:255',
            'device_type' => 'nullable|string|in:mobile,tablet,web',
            'os' => 'nullable|string|max:64',
            'app_version' => 'nullable|string|max:32',
            'fcm_token' => 'nullable|string',
        ]);

        try {
            $device = $deviceService->registerDevice(auth()->id(), [
                'device_id' => $request->device_id,
                'device_name' => $request->device_name,
                'device_type' => $request->device_type ?? 'mobile',
                'os' => $request->os,
                'app_version' => $request->app_version,
                'fcm_token' => $request->fcm_token,
            ]);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 403);
        }

        return response()->json([
            'message' => 'Device registered successfully.',
            'device' => $device->only(['id', 'device_id', 'device_name', 'device_type', 'os', 'active']),
        ], 201);
    }

    /**
     * تحديث FCM token فقط (عند تجدّده من التطبيق).
     *
     * PUT /api/devices/fcm
     * Body: device_id, fcm_token
     */
    public function updateFcmToken(Request $request, DeviceManagementService $deviceService)
    {
        $request->validate([
            'device_id' => 'required|string|max:255',
            'fcm_token' => 'nullable|string',
        ]);

        $device = $deviceService->updateFcmToken(
            auth()->id(),
            $request->device_id,
            $request->fcm_token
        );

        if (!$device) {
            return response()->json([
                'message' => 'Device not found. Call register first.',
            ], 404);
        }

        return response()->json([
            'message' => 'FCM token updated.',
            'device' => $device->only(['id', 'device_id', 'active']),
        ]);
    }

    /**
     * تسجيل خروج من الجهاز (إلغاء تفعيله).
     *
     * POST /api/devices/logout
     * Body: device_id
     */
    public function logoutDevice(Request $request, DeviceManagementService $deviceService)
    {
        $request->validate([
            'device_id' => 'required|string|max:255',
        ]);

        $deviceService->deactivateDevice(auth()->id(), $request->device_id);

        return response()->json(['message' => 'Device deactivated.']);
    }
}
