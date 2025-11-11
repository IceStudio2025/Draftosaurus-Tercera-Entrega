<?php

require_once __DIR__ . '/../utils/JsonResponse.php';
require_once __DIR__ . '/../repositories/UserRepository.php';

class UserController {
    private UserRepository $userRepository;
    
    public function __construct() {
        $this->userRepository = UserRepository::getInstance();
    }
    
    public function getCurrentUser() {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }
        
        if (empty($_SESSION['user_id'])) {
            $userInfo = isset($_COOKIE['user_info']) ? json_decode($_COOKIE['user_info'], true) : null;
            
            if (!$userInfo || empty($userInfo['id'])) {
                return JsonResponse::create([
                    'success' => false,
                    'message' => 'No hay usuario autenticado'
                ], 401);
            }
            
            $_SESSION['user_id'] = $userInfo['id'];
            $_SESSION['username'] = $userInfo['username'];
            $_SESSION['restored'] = true;
        }
        
        $userId = $_SESSION['user_id'];
        $user = $this->userRepository->getById($userId);
        
        if (!$user) {
            session_destroy();
            setcookie('user_info', '', time() - 3600, '/');
            return JsonResponse::create([
                'success' => false,
                'message' => 'Usuario no encontrado'
            ], 404);
        }
        
        if (isset($_SESSION['auth_time']) && (time() - $_SESSION['auth_time'] > 3600)) {
            session_regenerate_id(true);
            $_SESSION['auth_time'] = time();
        }
        
        return JsonResponse::create([
            'success' => true,
            'user' => $user,
            'session_valid' => true
        ]);
    }
    public function getAvailableOpponents($params) {
        try {
            if (!isset($params['user_id'])) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Falta user_id']);
                return;
            }
            $uid = (int)$params['user_id'];
            $repo = $this->userRepository ?? new UserRepository();
            $list = $repo->getOpponentsWithoutPending($uid);
            echo json_encode([
                'success' => true,
                'count' => count($list),
                'opponents' => $list
            ]);
        } catch (Throwable $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Error interno']);
        }
    }
    
    public function getUserInfo($request) {
        $userId = (int)$request['user_id'];
        
        if ($userId <= 0) {
            return JsonResponse::create([
                'success' => false,
                'message' => 'ID de usuario inválido'
            ], 400);
        }
        
        $user = $this->userRepository->getById($userId);
        
        if (!$user) {
            return JsonResponse::create([
                'success' => false,
                'message' => 'Usuario no encontrado'
            ], 404);
        }
        
        return JsonResponse::create([
            'success' => true,
            'user' => $user
        ]);
    }
}

?>
