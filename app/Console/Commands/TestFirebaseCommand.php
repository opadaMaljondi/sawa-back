<?php

namespace App\Console\Commands;

use App\Models\Device;
use App\Services\FirebaseService;
use Illuminate\Console\Command;

class TestFirebaseCommand extends Command
{
    protected $signature = 'firebase:test
                            {--fcm : إرسال إشعار تجريبي عبر FCM}
                            {--user= : معرّف المستخدم لإرسال الإشعار له (يجب أن يكون لديه fcm_token في devices)}';

    protected $description = 'اختبار إعداد Firebase (الاعتماديات، Realtime Database، واختيارياً FCM)';

    public function handle(FirebaseService $firebase): int
    {
        $this->info('--- اختبار Firebase ---');
        $this->newLine();

        // 1. التحقق من الملف
        $credentialsPath = config('firebase.credentials');
        if (empty($credentialsPath)) {
            $this->error('FIREBASE_CREDENTIALS غير مضبوط في .env');
            return self::FAILURE;
        }
        if (!file_exists($credentialsPath)) {
            $this->error('ملف الاعتماديات غير موجود: ' . $credentialsPath);
            return self::FAILURE;
        }
        $this->info('✓ ملف الاعتماديات موجود: ' . $credentialsPath);

        if (!$firebase->isConfigured()) {
            $this->error('Firebase غير مضبوط بشكل صحيح.');
            return self::FAILURE;
        }
        $this->info('✓ الإعداد صحيح');
        $this->newLine();

        // 2. اختبار Realtime Database
        $this->info('اختبار Realtime Database...');
        $dbUrl = config('firebase.database_url');
        if (empty($dbUrl)) {
            $this->warn('FIREBASE_DATABASE_URL غير مضبوط – تخطي اختبار Realtime.');
        } else {
            try {
                $db = $firebase->getDatabase();
                if (!$db) {
                    $this->error('فشل الاتصال بـ Realtime Database. راجع السجلات.');
                    return self::FAILURE;
                }
                $prefix = config('firebase.realtime_prefix', 'sawa');
                $testPath = $prefix . '/_test/' . time();
                $testValue = ['message' => 'اختبار من Laravel', 'at' => now()->toIso8601String()];
                $db->getReference($testPath)->set($testValue);
                $snapshot = $db->getReference($testPath)->getSnapshot();
                $read = $snapshot->getValue();
                $db->getReference($testPath)->remove();
                if ($read && ($read['message'] ?? '') === 'اختبار من Laravel') {
                    $this->info('✓ Realtime Database: كتابة وقراءة وحذف ناجحة');
                } else {
                    $this->warn('Realtime Database: القراءة لم تطابق القيمة المكتوبة.');
                }
            } catch (\Throwable $e) {
                $this->error('Realtime Database فشل: ' . $e->getMessage());
                return self::FAILURE;
            }
        }
        $this->newLine();

        // 3. اختبار FCM (اختياري)
        if ($this->option('fcm') || $this->option('user')) {
            $userId = $this->option('user') ? (int) $this->option('user') : null;
            if (!$userId) {
                $device = Device::where('active', true)->whereNotNull('fcm_token')->first();
                $userId = $device?->user_id;
            }
            if (!$userId) {
                $this->warn('لا يوجد مستخدم بجهاز مسجّل (fcm_token). سجّل التطبيق ثم أعد الاختبار مع: --user=1');
                return self::SUCCESS;
            }
            $tokens = Device::where('user_id', $userId)->where('active', true)->whereNotNull('fcm_token')->pluck('fcm_token')->all();
            if (empty($tokens)) {
                $this->warn('المستخدم ' . $userId . ' لا يملك fcm_token في جدول devices.');
                return self::SUCCESS;
            }
            $this->info('إرسال إشعار تجريبي إلى المستخدم ' . $userId . ' (' . count($tokens) . ' جهاز)...');
            try {
                $firebase->sendNotificationToUsers(
                    [$userId],
                    'اختبار Firebase',
                    'هذا إشعار تجريبي من أمر firebase:test',
                    ['type' => 'test']
                );
                $this->info('✓ تم إرسال طلب FCM. تحقق من الجهاز إن لم يصل الإشعار راجع قواعد FCM و token.');
            } catch (\Throwable $e) {
                $this->error('FCM فشل: ' . $e->getMessage());
                return self::FAILURE;
            }
        } else {
            $this->line('لاختبار FCM: php artisan firebase:test --fcm أو --user=1');
        }

        $this->newLine();
        $this->info('--- انتهى الاختبار ---');
        return self::SUCCESS;
    }
}
