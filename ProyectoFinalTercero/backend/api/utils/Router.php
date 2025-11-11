<?php

class Router {
    private $routes = [];

    public function get($path, $handler) {
        $this->addRoute('GET', $path, $handler);
    }

    public function post($path, $handler) {
        $this->addRoute('POST', $path, $handler);
    }

    public function put($path, $handler) {
        $this->addRoute('PUT', $path, $handler);
    }

    public function delete($path, $handler) {
        $this->addRoute('DELETE', $path, $handler);
    }

    private function addRoute($method, $path, $handler) {
        $this->routes[$method][$path] = $handler;
    }

    private function setCorsHeaders() {
        header('Access-Control-Max-Age: 3600');
    }

    public function run() {
        $this->setCorsHeaders();
        
        $method = $_SERVER['REQUEST_METHOD'];
        $uri = $_SERVER['REQUEST_URI'];
        
        if ($method === 'OPTIONS') {
            http_response_code(200);
            exit();
        }
        
        $uriParts = explode('?', $uri);
        $path = $uriParts[0];
        
        if (isset($this->routes[$method][$path])) {
            $handler = $this->routes[$method][$path];
            $params = [];
            
            if ($method !== 'GET') {
                $input = file_get_contents('php://input');
                $contentType = $_SERVER['CONTENT_TYPE'] ?? $_SERVER['HTTP_CONTENT_TYPE'] ?? '';
                
                if (!empty($input) && stripos($contentType, 'application/json') !== false) {
                    $decoded = json_decode($input, true);
                    if ($decoded === null && json_last_error() !== JSON_ERROR_NONE) {
                        parse_str($input, $formParams);
                        $params = is_array($formParams) ? $formParams : [];
                    } else {
                        $params = $decoded ?: [];
                    }
                } else if (!empty($_POST)) {
                    $params = $_POST;
                } else if (!empty($input)) {
                    parse_str($input, $formParams);
                    $params = is_array($formParams) ? $formParams : [];
                }
            }
            
            if (is_array($handler)) {
                $controller = $handler[0];
                $methodName = $handler[1];
                
                if (is_object($controller)) {
                    echo $controller->$methodName($params);
                } else if (is_string($controller) && class_exists($controller)) {
                    $controllerInstance = new $controller();
                    echo $controllerInstance->$methodName($params);
                } else {
                    http_response_code(500);
                    echo json_encode(['error' => 'Controlador no válido']);
                }
            } else if (is_callable($handler)) {
                echo $handler($params);
            }
            return;
        }
        
        foreach ($this->routes[$method] ?? [] as $routePath => $handler) {
            if (strpos($routePath, '{') !== false) {
                $routePathBase = explode('?', $routePath)[0];
                $pattern = preg_replace('/\{([^}]+)\}/', '([^/]+)', $routePathBase);
                $pattern = str_replace('/', '\/', $pattern);
                
                $pathBase = explode('?', $path)[0];
                
                if (preg_match('/^' . $pattern . '$/', $pathBase, $matches)) {
                    array_shift($matches);
                    
                    preg_match_all('/\{([^}]+)\}/', $routePath, $paramNames);
                    $paramNames = $paramNames[1];
                    $params = array_combine($paramNames, $matches);
                    
                    if ($method !== 'GET') {
                        $input = file_get_contents('php://input');
                        if (!empty($input)) {
                            $postParams = json_decode($input, true) ?: [];
                            $params = array_merge($params, $postParams);
                        }
                    }
                    
                    $controller = $handler[0];
                    $methodName = $handler[1];
                    
                    if (is_object($controller)) {
                        echo $controller->$methodName($params);
                    } else if (is_string($controller) && class_exists($controller)) {
                        $controllerInstance = new $controller();
                        echo $controllerInstance->$methodName($params);
                    } else {
                        http_response_code(500);
                        echo json_encode(['error' => 'Controlador no válido']);
                    }
                    return;
                }
            }
        }
        
        http_response_code(404);
        echo json_encode(['error' => 'Ruta no encontrada']);
    }
}
