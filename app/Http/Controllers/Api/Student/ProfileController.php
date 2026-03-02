<?php

namespace App\Http\Controllers\Api\Student;

use App\Http\Controllers\Controller;
use App\Models\Year;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;

class ProfileController extends Controller
{
    /**
     * Get student profile with department, year, and wallet balance.
     */
    public function show(Request $request)
    {
        $user = $request->user()->load(['department', 'year', 'wallet']);

        return response()->json([
            'user'   => $user,
            'wallet' => [
                'balance'         => (float) ($user->wallet->balance ?? 0),
                'currency'        => $user->wallet->currency ?? 'SYP',
                'total_deposited' => (float) ($user->wallet->total_deposited ?? 0),
                'total_spent'     => (float) ($user->wallet->total_spent ?? 0),
            ],
        ]);
    }

    /**
     * Update student profile (name, phone, image, password, department, year).
     */
    public function update(Request $request)
    {
        $user = $request->user();

        $data = $request->validate([
            'full_name'     => 'sometimes|string|max:255',
            'phone'         => 'sometimes|nullable|string|unique:users,phone,' . $user->id,
            'image'         => 'sometimes|nullable|image|max:2048',
            'department_id' => 'sometimes|nullable|exists:departments,id',
            'year_id'       => 'sometimes|nullable|exists:years,id',
            'password'      => 'sometimes|string|min:6|confirmed',
            'current_password' => 'required_with:password|string',
        ]);

        // Verify current password before changing it
        if (isset($data['password'])) {
            if (!$user->password || !Hash::check($data['current_password'], $user->password)) {
                return response()->json(['message' => 'Current password is incorrect.'], 422);
            }
            $data['password'] = Hash::make($data['password']);
        }

        // Validate year belongs to department if both provided
        if (isset($data['department_id']) && isset($data['year_id'])) {
            Year::where('id', $data['year_id'])
                ->where('department_id', $data['department_id'])
                ->firstOrFail();
        }

        // Handle profile image upload
        if ($request->hasFile('image')) {
            if ($user->image && Storage::disk('public')->exists($user->image)) {
                Storage::disk('public')->delete($user->image);
            }
            $data['image'] = $request->file('image')->store('profiles', 'public');
        }

        unset($data['current_password']);
        $user->update(array_filter($data, fn($v) => !is_null($v)));

        return response()->json([
            'message' => 'Profile updated successfully.',
            'user'    => $user->fresh(['department', 'year']),
        ]);
    }

    /**
     * Complete student profile (department, year, optional phone — for Google users).
     */
    public function complete(Request $request)
    {
        $user = $request->user();

        $data = $request->validate([
            'department_id' => 'required|exists:departments,id',
            'year_id'       => 'required|exists:years,id',
            'phone'         => 'nullable|string|unique:users,phone,' . $user->id,
        ]);

        Year::where('id', $data['year_id'])
            ->where('department_id', $data['department_id'])
            ->firstOrFail();

        $update = [
            'department_id' => $data['department_id'],
            'year_id'       => $data['year_id'],
        ];

        if (!empty($data['phone'])) {
            $update['phone'] = $data['phone'];
        }

        $user->update($update);

        return response()->json([
            'message' => 'Profile completed successfully.',
            'user'    => $user->fresh(['department', 'year']),
        ]);
    }
}
