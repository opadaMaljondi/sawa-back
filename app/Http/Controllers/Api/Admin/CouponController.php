<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Coupon;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class CouponController extends Controller
{
    /**
     * Paginated list of coupons (admin).
     */
    public function index(Request $request)
    {
        $perPage = min(max((int) $request->get('per_page', 15), 1), 100);

        $query = Coupon::query()->orderByDesc('id');

        if ($request->filled('search')) {
            $s = $request->get('search');
            $query->where(function ($q) use ($s) {
                $q->where('code', 'like', '%'.$s.'%')
                    ->orWhere('description', 'like', '%'.$s.'%');
            });
        }

        if ($request->has('active') && $request->get('active') !== '' && $request->get('active') !== null) {
            $query->where('active', filter_var($request->get('active'), FILTER_VALIDATE_BOOLEAN));
        }

        return $query->paginate($perPage);
    }

    /**
     * Store a new coupon.
     */
    public function store(Request $request)
    {
        $validated = $this->validatePayload($request);

        $validated['code'] = strtoupper(trim($validated['code']));
        $validated['created_by'] = $request->user()->id;
        if (! isset($validated['usage_per_user'])) {
            $validated['usage_per_user'] = 1;
        }

        $coupon = Coupon::create($validated);

        return response()->json([
            'message' => 'Coupon created successfully.',
            'coupon' => $coupon->fresh(),
        ], 201);
    }

    /**
     * Update an existing coupon.
     */
    public function update(Request $request, int $couponId)
    {
        $coupon = Coupon::findOrFail($couponId);

        $validated = $this->validatePayload($request, $coupon);

        if (isset($validated['code'])) {
            $validated['code'] = strtoupper(trim($validated['code']));
        }

        $coupon->update($validated);

        return response()->json([
            'message' => 'Coupon updated successfully.',
            'coupon' => $coupon->fresh(),
        ]);
    }

    /**
     * Delete a coupon (cascades usages).
     */
    public function destroy(int $couponId)
    {
        $coupon = Coupon::findOrFail($couponId);
        $coupon->delete();

        return response()->json(['message' => 'Coupon deleted successfully.']);
    }

    private function validatePayload(Request $request, ?Coupon $existing = null): array
    {
        $couponId = $existing?->id;

        $rules = [
            'code' => [
                'required',
                'string',
                'max:64',
                Rule::unique('coupons', 'code')->ignore($couponId),
            ],
            'description' => 'nullable|string|max:2000',
            'type' => 'required|in:percentage,fixed',
            'value' => 'required|numeric|min:0',
            'min_purchase' => 'nullable|numeric|min:0',
            'max_discount' => 'nullable|numeric|min:0',
            'usage_limit' => [
                'nullable',
                'integer',
                'min:1',
            ],
            'usage_per_user' => 'required|integer|min:1',
            'active' => 'boolean',
            'valid_from' => 'required|date',
            'valid_until' => 'required|date|after:valid_from',
        ];

        if ($existing) {
            $rules['code'] = [
                'sometimes',
                'required',
                'string',
                'max:64',
                Rule::unique('coupons', 'code')->ignore($couponId),
            ];
            $rules['description'] = 'sometimes|nullable|string|max:2000';
            $rules['type'] = 'sometimes|required|in:percentage,fixed';
            $rules['value'] = 'sometimes|required|numeric|min:0';
            $rules['min_purchase'] = 'sometimes|nullable|numeric|min:0';
            $rules['max_discount'] = 'sometimes|nullable|numeric|min:0';
            $rules['usage_per_user'] = 'sometimes|required|integer|min:1';
            $rules['active'] = 'sometimes|boolean';
            $rules['valid_from'] = 'sometimes|required|date';
            $rules['valid_until'] = 'sometimes|required|date|after:valid_from';
            $rules['usage_limit'] = [
                'sometimes',
                'nullable',
                'integer',
                'min:1',
            ];
        }

        $validated = $request->validate($rules);

        $type = $validated['type'] ?? $existing?->type;
        $value = isset($validated['value']) ? (float) $validated['value'] : null;

        if ($type === 'percentage' && $value !== null && $value > 100) {
            throw ValidationException::withMessages([
                'value' => ['Percentage value cannot exceed 100.'],
            ]);
        }

        if ($existing && array_key_exists('usage_limit', $validated)) {
            $limit = $validated['usage_limit'];
            if ($limit !== null && $limit < $existing->used_count) {
                throw ValidationException::withMessages([
                    'usage_limit' => ['Usage limit cannot be less than the number of times this coupon was already used ('.$existing->used_count.').'],
                ]);
            }
        }

        return $validated;
    }
}
