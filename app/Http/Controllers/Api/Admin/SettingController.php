<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class SettingController extends Controller
{
    /**
     * Display a listing of all settings.
     */
    public function index()
    {
        $settings = Setting::all();

        return response()->json($settings);
    }

    /**
     * Update multiple settings at once.
     * Keys must be in Setting::KEYS_META (not merely pre-existing rows), so empty DB / missing rows still work.
     */
    public function update(Request $request)
    {
        $allowed = array_keys(Setting::KEYS_META);

        $request->validate([
            'settings' => 'required|array|min:1',
            'settings.*.key' => ['required', 'string', Rule::in($allowed)],
            'settings.*.value' => 'nullable',
        ]);

        foreach ($request->settings as $item) {
            $key = $item['key'];
            $meta = Setting::KEYS_META[$key];
            $value = $item['value'] ?? null;

            Setting::updateOrCreate(
                ['key' => $key],
                [
                    'value' => is_array($value) ? json_encode($value) : $value,
                    'type' => $meta['type'],
                    'description' => $meta['description'],
                ]
            );
        }

        return response()->json(['message' => 'Settings updated successfully']);
    }
}
