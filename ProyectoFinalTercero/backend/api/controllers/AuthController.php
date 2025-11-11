<?php

require_once __DIR__ . '/../services/AuthService.php';
require_once __DIR__ . '/../utils/JsonResponse.php';

class AuthController {
    private AuthService $authService;

    public function __construct() {
        $this->authService = AuthService::getInstance();
    }

    public function register($request) {
        $data = is_array($request) ? $request : [];
        
        if (!isset($data['username']) || !isset($data['email']) || !isset($data['password'])) {
            return JsonResponse::create([
                'success' => false, 
                'code' => 'invalid',
                'message' => 'Todos los campos son obligatorios'
            ], 400);
        }
        
        $result = $this->authService->register(
            $data['username'],
            $data['email'],
            $data['password']
        );
        
        $statusCode = $result['success'] ? 201 : 400;
        return JsonResponse::create($result, $statusCode);
    }

    public function login($request) {
        $data = is_array($request) ? $request : [];
        
        if (!isset($data['identifier']) || !isset($data['password'])) {
            return JsonResponse::create([
                'success' => false, 
                'message' => 'Por favor proporciona todos los datos necesarios para iniciar sesión'
            ], 400);
        }
        
        $result = $this->authService->login(
            $data['identifier'],
            $data['password']
        );
        
        $statusCode = $result['success'] ? 200 : 401;
        
        if (!$result['success']) {
            $result['message'] = 'No se pudo iniciar sesión. Verifica tus credenciales.';
            if (isset($result['code'])) {
                unset($result['code']);
            }
        }
        
        if ($result['success']) {
            session_set_cookie_params(86400, '/', '', false, true);
            ini_set('session.cookie_httponly', '1');
            ini_set('session.use_only_cookies', '1');
            
            session_start();
            session_regenerate_id(true);
            
            $_SESSION['user_id'] = $result['user']['id'];
            $_SESSION['username'] = $result['user']['username'];
            $_SESSION['email'] = $result['user']['email'];
            $_SESSION['auth_time'] = time();
            
            setcookie('user_info', json_encode([
                'id' => $result['user']['id'],
                'username' => $result['user']['username']
            ]), [
                'expires' => time() + 86400,
                'path' => '/',
                'secure' => false,
                'httponly' => false,
                'samesite' => 'Lax'
            ]);
            
            $result['session_started'] = true;
            header('X-Session-Status: active');
        }
        
        return JsonResponse::create($result, $statusCode);
    }
    
    public function logout() {
        session_start();
        $_SESSION = array();
        
        if (ini_get("session.use_cookies")) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000,
                $params["path"], $params["domain"],
                $params["secure"], $params["httponly"]
            );
        }
        
        session_destroy();
        setcookie('user_session', '', time() - 3600, '/');
        
        return JsonResponse::create([
            'success' => true,
            'message' => 'Sesión cerrada exitosamente'
        ]);
    }

    public function createGuest($request) {
        $data = is_array($request) ? $request : [];
        
        if (!isset($data['username'])) {
            return JsonResponse::create([
                'success' => false, 
                'message' => 'El username es requerido'
            ], 400);
        }
        
        $result = $this->authService->createGuestUser($data['username']);
        
        $statusCode = $result['success'] ? 201 : 400;
        
        if ($result['success']) {
            session_set_cookie_params(86400, '/', '', false, true);
            ini_set('session.cookie_httponly', '1');
            ini_set('session.use_only_cookies', '1');
            
            session_start();
            session_regenerate_id(true);
            
            $_SESSION['user_id'] = $result['user']['id'];
            $_SESSION['username'] = $result['user']['username'];
            $_SESSION['email'] = $result['user']['email'];
            $_SESSION['auth_time'] = time();
            $_SESSION['is_guest'] = true;
            
            setcookie('user_info', json_encode([
                'id' => $result['user']['id'],
                'username' => $result['user']['username']
            ]), [
                'expires' => time() + 86400,
                'path' => '/',
                'secure' => false,
                'httponly' => false,
                'samesite' => 'Lax'
            ]);
        }
        
        return JsonResponse::create($result, $statusCode);
    }
}
