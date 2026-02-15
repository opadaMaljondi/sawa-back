<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>YouTube - خطأ</title>
    <style>
        body { font-family: system-ui, sans-serif; max-width: 500px; margin: 80px auto; padding: 20px; text-align: center; }
        .err { color: #dc2626; font-size: 48px; margin-bottom: 16px; }
        h1 { color: #1f2937; }
        p { color: #6b7280; background: #fef2f2; padding: 12px; border-radius: 8px; }
    </style>
</head>
<body>
    <div class="err">✗</div>
    <h1>فشل الربط مع YouTube</h1>
    <p>{{ $error ?? 'حدث خطأ غير معروف.' }}</p>
</body>
</html>
