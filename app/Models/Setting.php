<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Setting extends Model
{
    use HasFactory;

    /**
     * Keys the admin API may read/write (must match admin dashboard fields).
     * Values: [ 'type' => string, 'description' => string|null ]
     */
    public const KEYS_META = [
        'site_name' => ['type' => 'string', 'description' => 'اسم الموقع'],
        'site_description' => ['type' => 'string', 'description' => 'وصف الموقع'],
        'contact_email' => ['type' => 'string', 'description' => 'بريد التواصل'],
        'contact_phone' => ['type' => 'string', 'description' => 'رقم التواصل'],
        'address' => ['type' => 'string', 'description' => 'العنوان'],
        'maintenance_mode' => ['type' => 'boolean', 'description' => 'وضع الصيانة'],
        'allow_registration' => ['type' => 'boolean', 'description' => 'السماح بالتسجيل الجديد'],
        'referral_program_enabled' => ['type' => 'boolean', 'description' => 'تفعيل نظام الإحالة'],
        'referral_first_subscription_discount_percent' => ['type' => 'number', 'description' => 'خصم أول اشتراك للمدعو (% من السعر، 0 لتعطيل واستخدام المبلغ الثابت)'],
        'referral_first_subscription_discount_fixed' => ['type' => 'number', 'description' => 'خصم أول اشتراك للمدعو (مبلغ ثابت ل.س إذا كانت النسبة 0)'],
        'referral_enrollment_bonus' => ['type' => 'number', 'description' => 'مكافأة محفظة المحيل عند أول اشتراك للمدعو (ل.س)'],
        'support_phone' => ['type' => 'string', 'description' => 'هاتف الدعم (تطبيق الطالب)'],
        'support_email' => ['type' => 'string', 'description' => 'بريد الدعم (تطبيق الطالب)'],
        'support_whatsapp' => ['type' => 'string', 'description' => 'واتساب الدعم'],
        'support_telegram' => ['type' => 'string', 'description' => 'تيليجرام الدعم'],
        'privacy_policy' => ['type' => 'string', 'description' => 'سياسة الخصوصية (تطبيق الطالب)'],
        'terms_and_conditions' => ['type' => 'string', 'description' => 'الشروط والأحكام (تطبيق الطالب)'],
    ];

    protected $fillable = [
        'key',
        'value',
        'type',
        'description',
    ];

    /**
     * Get a setting value by key.
     */
    public static function get($key, $default = null)
    {
        $setting = self::where('key', $key)->first();
        if (! $setting) {
            return $default;
        }

        return self::castValue($setting->value, $setting->type);
    }

    /**
     * Set a setting value by key.
     */
    public static function set($key, $value, $type = 'string', $description = null)
    {
        return self::updateOrCreate(
            ['key' => $key],
            [
                'value' => is_array($value) ? json_encode($value) : $value,
                'type' => $type,
                'description' => $description,
            ]
        );
    }

    /**
     * Cast value based on type.
     */
    private static function castValue($value, $type)
    {
        switch ($type) {
            case 'boolean': return filter_var($value, FILTER_VALIDATE_BOOLEAN);
            case 'number': return is_numeric($value) ? $value + 0 : $value;
            case 'json': return json_decode($value, true);
            default: return $value;
        }
    }
}
