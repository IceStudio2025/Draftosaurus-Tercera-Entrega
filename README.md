Acá tenés **toda la descripción adaptada a tu empresa IceStudio**, con los nombres reales, los comandos correctos de XAMPP y la explicación de la SQL, más los links oficiales pedidos.
Lo dejé con tono profesional pero entendible.

---

## ✅ **Draftosaurus – Proyecto Web presentado por IceStudio (3MA)**


https://github.com/IceStudio2025/Draftosaurus-Tercera-Entrega/blob/01c7e0db2deb7ecfa318a6f5b18cc30c6048e105/ProyectoFinalTercero/frontend/img/icestudio.png

¡Bienvenido a Draftosaurus Web!
Una aplicación interactiva desarrollada por IceStudio, utilizando **HTML, CSS, JavaScript, PHP y MySQL**.

---

### ✨ **Descripción del proyecto**

Este trabajo corresponde a la entrega final de **IceStudio – 3ºMA**.

El objetivo es virtualizar el juego Draftosaurus en formato de página web, construido como una **Single-Page Application**, para ofrecer una experiencia rápida, fluida y sin recargas constantes.
Una vez cargada la estructura principal, únicamente se intercambian pequeños datos con el servidor (como qué dinosaurio seleccionó el jugador o el resultado del dado).
Esto permite animaciones, transiciones y una jugabilidad tipo aplicación móvil o de escritorio.

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
* Tailwind CSS
* PHP
* MySQL
* VS Code
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

```
cd Draftosaurus-Tercera-Entrega
code .
```

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

Se abrirá en el navegador la versión jugable del proyecto.

---

Si querés lo preparo también como README para GitHub (con formato .md), o con capturas, emojis y tabla de contenido. ¿Querés versión README lista para subir al repo?
