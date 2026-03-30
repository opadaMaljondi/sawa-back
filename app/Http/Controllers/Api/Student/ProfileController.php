<?php

namespace App\Http\Controllers\Api\Student;

use App\Http\Controllers\Controller;
use App\Models\Year;
use App\Support\StudentWalletQr;
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
            'wallet_qr' => StudentWalletQr::qrPayload($user->id),

        ]);
    }

    /**
     * Update student profile (name, phone, image, password, department, year).
     *
     * Use POST (not PUT) when sending multipart/form-data — PHP often does not populate PUT bodies.
     */
    public function update(Request $request)
    {
        $user = $request->user();

        $this->prepareStudentProfileRequest($request);

        $data = $request->validate([
            'full_name' => 'sometimes|string|max:255',
            'phone' => 'sometimes|nullable|string|unique:users,phone,'.$user->id,
            'image' => 'sometimes|nullable|image',
            'department_id' => 'sometimes|nullable|exists:departments,id',
            'year_id' => 'sometimes|nullable|exists:years,id',
            'password' => 'sometimes|required|string|min:6|confirmed',
            'current_password' => 'required_with:password|string',
        ]);

        // Verify current password before changing it
        if (isset($data['password'])) {
            if (! $user->password || ! Hash::check($data['current_password'], $user->password)) {
                return response()->json(['message' => 'Current password is incorrect.'], 422);
            }
            $data['password'] = Hash::make($data['password']);
        }

        if (isset($data['department_id']) && isset($data['year_id'])) {
            Year::where('id', $data['year_id'])
                ->where('department_id', $data['department_id'])
                ->firstOrFail();
        } elseif (isset($data['year_id'])) {
            Year::where('id', $data['year_id'])
                ->where('department_id', $user->department_id)
                ->firstOrFail();
        } elseif (isset($data['department_id']) && $user->year_id) {
            Year::where('id', $user->year_id)
                ->where('department_id', $data['department_id'])
                ->firstOrFail();
        }

        // Handle profile image upload
        if ($request->hasFile('image')) {
            if ($user->image && ! filter_var($user->image, FILTER_VALIDATE_URL)) {
                Storage::disk('public')->delete($user->image);
            }
            $data['image'] = $request->file('image')->store('profiles', 'public');
        }

        unset($data['current_password'], $data['password_confirmation']);

        $allowed = ['full_name', 'phone', 'image', 'department_id', 'year_id', 'password'];
        $update = array_filter(
            array_intersect_key($data, array_flip($allowed)),
            fn ($v) => ! is_null($v)
        );

        if ($update === [] && ! $request->hasFile('image')) {
            return response()->json([
                'message' => 'No profile fields to update. For file uploads use POST with multipart/form-data (PUT multipart is often empty on the server).',
            ], 422);
        }

        $user->update($update);

        return response()->json([
            'message' => 'Profile updated successfully.',
            'user' => $user->fresh(['department', 'year', 'wallet']),
            'wallet_qr' => StudentWalletQr::qrPayload($user->id),
        ]);
    }

    /**
     * Flatten common client payloads and strip empty password fields so "sometimes" rules work.
     */
    private function prepareStudentProfileRequest(Request $request): void
    {
        if ($request->has('user') && is_array($request->input('user'))) {
            $request->merge($request->input('user'));
        }
        if ($request->filled('name') && ! $request->filled('full_name')) {
            $request->merge(['full_name' => $request->input('name')]);
        }

        $pw = $request->input('password');
        if ($pw === null || $pw === '') {
            $request->request->remove('password');
            $request->request->remove('password_confirmation');
            $request->request->remove('current_password');
        }
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
            'image'         => 'nullable|image|max:2048',
        ]);

        Year::where('id', $data['year_id'])
            ->where('department_id', $data['department_id'])
            ->firstOrFail();

        $update = [
            'department_id' => $data['department_id'],
            'year_id'       => $data['year_id'],
        ];

        if (! empty($data['phone'])) {
            $update['phone'] = $data['phone'];
        }

        if ($request->hasFile('image')) {
            if ($user->image && ! filter_var($user->image, FILTER_VALIDATE_URL)) {
                Storage::disk('public')->delete($user->image);
            }
            $update['image'] = $request->file('image')->store('profiles', 'public');
        }

        $user->update($update);

        $user->loadMissing('wallet');
        if (! $user->wallet) {
            $user->wallet()->create([
                'balance' => 0,
                'currency' => 'SYP',
                'total_deposited' => 0,
                'total_spent' => 0,
                'active' => true,
            ]);
        }
        $user->load(['department', 'year', 'wallet']);

        return response()->json([
            'message' => 'Profile completed successfully.',
            'user' => $user,
            'wallet_qr' => StudentWalletQr::qrPayload($user->id),
        ]);
    }
}
