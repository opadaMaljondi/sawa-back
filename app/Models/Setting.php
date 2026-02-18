<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Setting extends Model
{
    use HasFactory;

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
        if (!$setting) return $default;

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
                'description' => $description
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
