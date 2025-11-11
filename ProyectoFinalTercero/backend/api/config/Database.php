<?php

class Database {

    private $host;
    private $db_name;
    private $username;
    private $password;
    private $conn;

    public function __construct() {
        $this->host = 'localhost';
        $this->db_name = 'draftosaurus';
        $this->username = 'root';
        $this->password = '';
    }

    public function connect() {
        $this->conn = new mysqli($this->host, $this->username, $this->password, $this->db_name);

        if ($this->conn->connect_error) {
            throw new Exception('Error de conexión a la base de datos: ' . $this->conn->connect_error);
        }
        
        $this->conn->set_charset("utf8");
        
        return $this->conn;
    }
}

