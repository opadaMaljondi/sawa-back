<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Banner;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class BannerController extends Controller
{
    /**
     * Get all banners
     */
    public function index()
    {
        $banners = Banner::orderBy('order')->get();

        return response()->json($banners);
    }

    /**
     * Create banner
     */
    public function store(Request $request)
    {
        $request->validate([
            'title' => 'nullable|string|max:255',
            'image' => 'required|image|max:5120', // 5MB max
            'link_type' => 'required|in:none,course,subject,url',
            'link_id' => 'nullable|integer',
            'link_url' => 'nullable|url',
            'order' => 'nullable|integer',
        ]);

        $imagePath = $request->file('image')->store('banners', 'public');

        $banner = Banner::create([
            'title' => $request->title,
            'image_path' => $imagePath,
            'link_type' => $request->link_type,
            'link_id' => $request->link_id ?? null,
            'link_url' => $request->link_url ?? null,
            'order' => $request->order ?? 1,
            'active' => true,
        ]);

        return response()->json([
            'message' => 'Banner created successfully',
            'banner' => $banner,
        ], 201);
    }

    /**
     * Update banner
     */
    public function update(Request $request, $bannerId)
    {
        $banner = Banner::findOrFail($bannerId);

        $request->validate([
            'title' => 'nullable|string|max:255',
            'image' => 'sometimes|image|max:5120',
            'link_type' => 'sometimes|in:none,course,subject,url',
            'link_id' => 'nullable|integer',
            'link_url' => 'nullable|url',
            'order' => 'nullable|integer',
            'active' => 'boolean',
        ]);

        if ($request->hasFile('image')) {
            // حذف الصورة القديمة
            if ($banner->image_path) {
                Storage::disk('public')->delete($banner->image_path);
            }

            $imagePath = $request->file('image')->store('banners', 'public');
            $banner->image_path = $imagePath;
        }

        $banner->update($request->only(['title', 'link_type', 'link_id', 'link_url', 'order', 'active']));

        return response()->json([
            'message' => 'Banner updated successfully',
            'banner' => $banner,
        ]);
    }

    /**
     * Delete banner
     */
    public function destroy($bannerId)
    {
        $banner = Banner::findOrFail($bannerId);

        // حذف الصورة
        if ($banner->image_path) {
            Storage::disk('public')->delete($banner->image_path);
        }

        $banner->delete();

        return response()->json(['message' => 'Banner deleted successfully']);
    }
}
