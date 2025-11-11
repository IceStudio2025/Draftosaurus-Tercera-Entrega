<?php

require_once __DIR__ . '/../controllers/ChatbotController.php';

class ChatbotRoutes {
    public static function register($router) {
        $chatbotController = new ChatbotController();
        $router->post('/api/chatbot', [$chatbotController, 'sendMessage']);
    }
}




