<?php

namespace App\Http\Middleware;

use App\Services\DeviceManagementService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckDeviceLimitMiddleware
{
    protected DeviceManagementService $deviceService;

    public function __construct(DeviceManagementService $deviceService)
    {
        $this->deviceService = $deviceService;
    }

    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next): Response
    {
        if (!auth()->check()) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        $user = auth()->user();
        $deviceId = $request->header('X-Device-ID');

        if ($deviceId) {
            try {
                // التحقق من الجهاز أو تسجيله
                $this->deviceService->registerDevice($user->id, [
                    'device_id' => $deviceId,
                    'device_name' => $request->header('X-Device-Name', 'Unknown'),
                    'device_type' => $request->header('X-Device-Type', 'mobile'),
                    'os' => $request->header('X-Device-OS'),
                    'app_version' => $request->header('X-App-Version'),
                    'fcm_token' => $request->header('X-FCM-Token'),
                ]);
            } catch (\Exception $e) {
                return response()->json([
                    'message' => $e->getMessage()
                ], 403);
            }
        }

        return $next($request);
    }
}
