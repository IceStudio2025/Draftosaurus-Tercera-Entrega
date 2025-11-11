<?php

class Logger {
    private static ?Logger $instance = null;
    private string $logFile;
    private bool $debugMode;

    private function __construct() {
        $this->logFile = __DIR__ . '/../../logs/app.log';
        $this->debugMode = true;
        
        $logDir = dirname($this->logFile);
        if (!file_exists($logDir)) {
            mkdir($logDir, 0755, true);
        }
    }

    public static function getInstance(): Logger {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    public function info(string $message): void {
        $this->log('INFO', $message);
    }

    public function warning(string $message): void {
        $this->log('WARNING', $message);
    }

    public function error(string $message): void {
        $this->log('ERROR', $message);
    }

    public function exception(string $message, \Throwable $exception): void {
        $exceptionDetails = sprintf(
            "%s: %s in %s:%d\nStack trace:\n%s",
            get_class($exception),
            $exception->getMessage(),
            $exception->getFile(),
            $exception->getLine(),
            $exception->getTraceAsString()
        );
        
        $this->log('EXCEPTION', "$message\n$exceptionDetails");
    }

    public function debug(string $message): void {
        if ($this->debugMode) {
            $this->log('DEBUG', $message);
        }
    }

    private function log(string $level, string $message): void {
        $timestamp = date('Y-m-d H:i:s');
        $formattedMessage = "[$timestamp] [$level] $message" . PHP_EOL;
        
        if ($this->debugMode) {
            error_log($formattedMessage);
        }
        
        try {
            file_put_contents($this->logFile, $formattedMessage, FILE_APPEND);
        } catch (\Throwable $e) {
            error_log("No se pudo escribir en el archivo de log: " . $e->getMessage());
        }
    }
}
