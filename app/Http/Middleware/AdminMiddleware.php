<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AdminMiddleware
{
    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next): Response
    {
        if (!auth()->check()) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        $user = auth()->user();

        if ($user->type !== 'admin') {
            return response()->json(['message' => 'Access denied. Admin only.'], 403);
        }

        if (!$user->active) {
            return response()->json(['message' => 'Account is inactive'], 403);
        }

        return $next($request);
    }
}
