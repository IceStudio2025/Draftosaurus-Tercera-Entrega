<?php

require_once __DIR__ . '/../repositories/UserRepository.php';

class AuthService
{
    private static ?AuthService $instance = null;
    private ?UserRepository $userRepository;

    private function __construct()
    {
        $this->userRepository = UserRepository::getInstance();
    }

    public static function getInstance(): ?AuthService
    {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    public function register(string $username, string $email, string $password): array
    {
        $username = trim($username);
        $email = trim($email);
        $password = (string)$password;

        if ($username === '' || $email === '' || $password === '') {
            return ['success' => false, 'code' => 'invalid', 'message' => 'Username, email y contraseña son requeridos.'];
        }

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return ['success' => false, 'code' => 'invalid', 'message' => 'Email inválido.'];
        }

        if (strlen($username) < 3) {
            return ['success' => false, 'code' => 'invalid', 'message' => 'El username debe tener al menos 3 caracteres.'];
        }
        if (strlen($password) < 6) {
            return ['success' => false, 'code' => 'invalid', 'message' => 'La contraseña debe tener al menos 6 caracteres.'];
        }

        $existingUsername = $this->userRepository->findByUsername($username);
        if ($existingUsername) {
            return ['success' => false, 'code' => 'duplicate', 'message' => 'El username ya está registrado.'];
        }

        $existingEmail = $this->userRepository->findByEmail($email);
        if ($existingEmail) {
            return ['success' => false, 'code' => 'duplicate', 'message' => 'El email ya está registrado.'];
        }

        $hash = password_hash($password, PASSWORD_DEFAULT);
        if ($hash === false) {
            return ['success' => false, 'code' => 'error', 'message' => 'No se pudo procesar la contraseña.'];
        }

        $created = $this->userRepository->create($username, $email, $hash);
        if ($created === false) {
            return ['success' => false, 'code' => 'error', 'message' => 'No se pudo crear el usuario.'];
        }

        return [
            'success' => true,
            'message' => 'Usuario creado exitosamente.',
            'user' => [
                'id' => (int)$created['user_id'],
                'username' => $created['username'],
                'email' => $created['email'],
            ],
        ];
    }

    private function verifyCredentials(string $identifier, string $plainPassword)
    {
        $user = $this->userRepository->findByUsernameOrEmail($identifier);

        if (!$user || !isset($user['password_hash']) || !is_string($user['password_hash'])) {
            return false;
        }

        if (strpos($user['password_hash'], '$2y$') === 0) {
            if (!password_verify($plainPassword, $user['password_hash'])) {
                return false;
            }
        } else {
            if ($user['password_hash'] !== $plainPassword) {
                return false;
            }
            $hash = password_hash($plainPassword, PASSWORD_DEFAULT);
            $this->userRepository->updatePasswordHash($user['user_id'], $hash);
        }

        return [
            'id' => (int)$user['user_id'],
            'username' => $user['username'] ?? null,
            'email' => $user['email'],
        ];
    }

    public function login(string $identifier, string $password): array
    {
        $basicUser = $this->verifyCredentials($identifier, $password);
        if ($basicUser === false) {
            return [
                'success' => false, 
                'code' => 'auth_failed', 
                'message' => 'Las credenciales proporcionadas no son válidas.'
            ];
        }

        return [
            'success' => true,
            'message' => 'Login exitoso.',
            'user' => [
                'id' => $basicUser['id'],
                'email' => $basicUser['email'],
                'username' => $basicUser['username'],
            ],
        ];
    }

    public function createGuestUser(string $username): array
    {
        $username = trim($username);
        
        if ($username === '' || strlen($username) < 3) {
            return ['success' => false, 'message' => 'El username debe tener al menos 3 caracteres.'];
        }

        $existing = $this->userRepository->findByUsername($username);
        if ($existing) {
            $baseUsername = $username;
            $counter = 1;
            do {
                $username = $baseUsername . '_' . $counter;
                $existing = $this->userRepository->findByUsername($username);
                $counter++;
            } while ($existing && $counter < 1000);
        }

        $tempEmail = 'guest_' . time() . '_' . uniqid() . '@guest.local';
        $tempPassword = bin2hex(random_bytes(16));
        $hash = password_hash($tempPassword, PASSWORD_DEFAULT);

        $created = $this->userRepository->create($username, $tempEmail, $hash);
        if (!$created) {
            return ['success' => false, 'message' => 'No se pudo crear el usuario invitado.'];
        }

        return [
            'success' => true,
            'message' => 'Usuario invitado creado exitosamente.',
            'user' => [
                'id' => (int)$created['user_id'],
                'username' => $created['username'],
                'email' => $created['email'],
            ],
        ];
    }
}
