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
