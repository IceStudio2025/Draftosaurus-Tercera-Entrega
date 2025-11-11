
---

## ✅ **Draftosaurus – Proyecto Web presentado por IceStudio**

![Image Alt](https://github.com/IceStudio2025/Draftosaurus-Tercera-Entrega/blob/01c7e0db2deb7ecfa318a6f5b18cc30c6048e105/ProyectoFinalTercero/frontend/img/icestudio.png?raw=true)

¡Bienvenido a Draftosaurus Web!
Una aplicación interactiva desarrollada por IceStudio, utilizando **HTML, CSS, JavaScript, PHP y MySQL**.

---

### ✨ **Descripción del proyecto**

Este trabajo corresponde a la entrega final de **IceStudio – 3ºMA**.

---

### 👥 **Integrantes IceStudio**

* **Axel Di Pascua**
* **Morena Piriz**
* **Juan Deliotti**
* **Enzo Méndez**
* **Julieta Silva**

---

### 🛠️ **Tecnologías utilizadas**

* HTML5
* CSS3
* JavaScript
* PHP
* MySQL
* Visual Studio Code
* Apache / XAMPP

---

## 🚀 **Cómo instalar y ejecutar el proyecto**

### ✅ Paso 1 – Clonar el repositorio

Abrir la Terminal en el escritorio y ejecutar:

```
git clone https://github.com/IceStudio2025/Draftosaurus-Tercera-Entrega.git
```

---

### ✅ Paso 2 – Abrir el proyecto en Visual Studio Code

Mover la carpeta de "ProyectoFinalTercero" hacia el VScode

---

### ✅ Paso 3 – Instalar Live Server

(para visualizar el frontend en el navegador)

🔗 **Link directo a VSCode:**
[https://code.visualstudio.com/](https://code.visualstudio.com/)

🔗 **Link directo extensión Live Server:**
[https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer)

En VS Code:

1. Ir a Extensiones (Ctrl + Shift + X)
2. Buscar **Live Server – Ritwick Dey**
3. Instalar

---

### ✅ Paso 4 – Instalar Apache y MySQL (XAMPP)

🔗 **Descarga de XAMPP (incluye Apache y MySQL):**
[https://www.apachefriends.org/es/index.html](https://www.apachefriends.org/es/index.html)

Para que el juego funcione deben estar encendidos:
✅ **Apache**
✅ **MySQL**

---

### ✅ Paso 5 – Importar la base de datos

1. Abrir **phpMyAdmin** desde XAMPP
2. Crear una base de datos nueva
3. Importar el archivo `.sql` que está en la carpeta **sql** del proyecto

---

### ✅ Paso 6 – Ejecutar el backend PHP

Abrir una terminal dentro del proyecto con **Ctrl + ñ**
y ejecutar:

✅ **Para jugar en modo local:**

```
C:\xampp\php\php.exe -S localhost:8000 -t backend/api
```

✅ **Para jugar en red LAN (multijugador):**

```
C:\xampp\php\php.exe -S 0.0.0.0:8000 -t backend/api
```

Con esto cualquier dispositivo dentro de la misma red puede entrar usando la IP de la PC + :8000

---

### ✅ Paso 7 – Ver el juego

En VS Code, abrir `homepage.html`
Click derecho → **Open with Live Server**

Se abrirá en el navegador la pagina de inicio, donde podras explorar la información del equipo y su tienda, luego tendrian que tocar "Jugar" donde te registrarias, para luego loguearte 
y entrar en el menu del jugador, donde podrias explorar distintas secciones del juego.

---
