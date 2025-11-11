<?php

require_once __DIR__ . '/JsonResponse.php';

class ErrorHandler {
    private static $instance = null;

    public static function getInstance(): ErrorHandler {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    public function handleApiError(Exception $e, string $context = ''): string {
        return JsonResponse::create([
            'success' => false,
            'error' => $e->getMessage(),
            'debug' => [
                'context' => $context,
                'exception' => get_class($e),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'trace' => explode("\n", $e->getTraceAsString())
            ]
        ], 500);
    }
    
    public function handleValidationError(string $message): string {
        return JsonResponse::create([
            'success' => false,
            'error' => 'Validation error',
            'message' => $message
        ], 400);
    }
}
