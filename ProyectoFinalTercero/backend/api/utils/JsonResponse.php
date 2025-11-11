<?php

class JsonResponse {
    public static function create($data, int $statusCode = 200): string {
        http_response_code($statusCode);
        header('Content-Type: application/json');
        return json_encode($data);
    }
}