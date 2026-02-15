<?php

namespace App\Services;

use App\Models\Course;
use App\Models\Department;
use App\Models\Enrollment;
use App\Models\User;
use App\Models\UserNotification;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class NotificationService
{
    public const SCOPE_GENERAL = 'general';
    public const SCOPE_DEPARTMENT = 'department';
    public const SCOPE_COURSE = 'course';
    public const SCOPE_CHAT = 'chat';

    public const TYPE_SYSTEM = 'system';
    public const TYPE_COURSE = 'course';
    public const TYPE_MESSAGE = 'message';
    public const TYPE_PAYMENT = 'payment';

    public function __construct(
        protected FirebaseService $firebase
    ) {}

    /**
     * ١ - إشعارات عامة لكل المستخدمين (مثل التحديثات والتحذيرات).
     */
    public function sendGeneral(string $title, string $message, array $data = []): array
    {
        $userIds = User::where('active', true)->pluck('id')->all();
        return $this->sendToUserIds($userIds, $title, $message, self::SCOPE_GENERAL, null, self::TYPE_SYSTEM, $data);
    }

    /**
     * ٢ - إشعارات مخصصة للطلاب التابعين لفرع (قسم) محدد.
     * الطلاب الذين اشتركوا في أي كورس تابع لمادة من هذا القسم.
     */
    public function sendToDepartment(int $departmentId, string $title, string $message, array $data = []): array
    {
        $department = Department::findOrFail($departmentId);
        $userIds = Enrollment::where('active', true)
            ->whereHas('course.subject', fn ($q) => $q->where('department_id', $departmentId))
            ->pluck('student_id')
            ->unique()
            ->values()
            ->all();
        $data['department_id'] = (string) $departmentId;
        return $this->sendToUserIds($userIds, $title, $message, self::SCOPE_DEPARTMENT, $departmentId, self::TYPE_SYSTEM, $data);
    }

    /**
     * ٣ - إشعارات مخصصة للمشتركين في كورس معين فقط.
     */
    public function sendToCourse(int $courseId, string $title, string $message, array $data = []): array
    {
        $course = Course::findOrFail($courseId);
        $userIds = Enrollment::where('course_id', $courseId)
            ->where('active', true)
            ->pluck('student_id')
            ->unique()
            ->values()
            ->all();
        $data['course_id'] = (string) $courseId;
        return $this->sendToUserIds($userIds, $title, $message, self::SCOPE_COURSE, $courseId, self::TYPE_COURSE, $data);
    }

    /**
     * حفظ الإشعار في جدول notifications وإرسال FCM للمستخدمين.
     */
    protected function sendToUserIds(
        array $userIds,
        string $title,
        string $message,
        string $scope = self::SCOPE_GENERAL,
        ?int $targetId = null,
        string $type = self::TYPE_SYSTEM,
        array $data = []
    ): array {
        $userIds = array_unique(array_filter($userIds));
        if (empty($userIds)) {
            return ['stored' => 0, 'fcm_sent' => false];
        }

        $stored = 0;
        try {
            DB::transaction(function () use ($userIds, $title, $message, $scope, $targetId, $type, $data, &$stored) {
                foreach ($userIds as $userId) {
                    UserNotification::create([
                        'user_id' => $userId,
                        'title' => $title,
                        'message' => $message,
                        'type' => $type,
                        'scope' => $scope,
                        'target_id' => $targetId,
                        'data' => $data ?: null,
                    ]);
                    $stored++;
                }
            });
        } catch (\Throwable $e) {
            Log::error('NotificationService store failed: ' . $e->getMessage());
            return ['stored' => 0, 'fcm_sent' => false, 'error' => $e->getMessage()];
        }

        $fcmSent = false;
        if ($this->firebase->isFcmEnabled()) {
            try {
                $this->firebase->sendNotificationToUsers(
                    $userIds,
                    $title,
                    $message,
                    array_merge($data, ['type' => 'app_notification', 'scope' => $scope])
                );
                $fcmSent = true;
            } catch (\Throwable $e) {
                Log::warning('NotificationService FCM failed: ' . $e->getMessage());
            }
        }

        return ['stored' => $stored, 'fcm_sent' => $fcmSent];
    }
}
