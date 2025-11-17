// Función para obtener la URL base de la API
const getApiBase = () => window.getApiBase ? window.getApiBase() : "http://localhost:8000";

const API_URLS = {
  get login() { return `${getApiBase()}/api/auth/login`; },
  get register() { return `${getApiBase()}/api/auth/register`; },
  get guest() { return `${getApiBase()}/api/auth/guest`; },
};

export const PAGES = {
  login: "login.html",
  register: "registro.html",
  menu: "menujugador.html",
  seleccionarOponente: "partidarapida.html",
  juego: "juego.html",
};

async function iniciarSesion(identifier, password) {
  try {
    const response = await fetch(API_URLS.login, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ identifier, password }),
      credentials: "include",
    });

    const text = await response.text();
    let data;

    try {
      data = JSON.parse(text);
    } catch (parseError) {
      console.error("Error al parsear la respuesta como JSON:", parseError);
      return {
        success: false,
        message: "El servidor respondió con un formato inválido",
        error: "parse_error",
      };
    }

    if (data.success === true && data.user) {
      localStorage.setItem("userId", data.user.id);
      localStorage.setItem("username", data.user.username);
    }

    return {
      success: data.success === true,
      message: data.message || "Error al iniciar sesión",
      user: data.user || null,
    };
  } catch (error) {
    console.error("Error al iniciar sesión:", error);
    return {
      success: false,
      message: "Error de conexión al servidor",
      user: null,
    };
  }
}

function obtenerIdUsuario() {
  const userId = localStorage.getItem("userId");
  if (!userId) return null;
  
  if (typeof userId === 'string' && userId.startsWith('guest_')) {
    return null;
  }
  
  return parseInt(userId);
}

function obtenerNombreUsuario() {
  return localStorage.getItem("username");
}

function esInvitado() {
  return localStorage.getItem("isGuest") === "true";
}

async function iniciarSesionInvitado() {
  const guestUsername = "Invitado_" + Math.random().toString(36).substr(2, 6).toUpperCase();
  
  try {
    const response = await fetch(API_URLS.guest, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username: guestUsername }),
      credentials: "include",
    });

    const text = await response.text();
    let data;

    try {
      data = JSON.parse(text);
    } catch (parseError) {
      console.error("Error al parsear la respuesta como JSON:", parseError);
      return {
        success: false,
        message: "El servidor respondió con un formato inválido",
        error: "parse_error",
      };
    }

    if (data.success === true && data.user) {
      localStorage.setItem("userId", data.user.id);
      localStorage.setItem("username", data.user.username);
      localStorage.setItem("isGuest", "true");
      
      return {
        success: true,
        message: data.message || "Invitado creado exitosamente",
        user: {
          id: data.user.id,
          username: data.user.username
        }
      };
    }

    return {
      success: false,
      message: data.message || "Error al crear usuario invitado",
      user: null,
    };
  } catch (error) {
    console.error("Error al crear usuario invitado:", error);
    return {
      success: false,
      message: "Error de conexión al servidor",
      user: null,
    };
  }
}

function cerrarSesion() {
  localStorage.removeItem("userId");
  localStorage.removeItem("username");
  localStorage.removeItem("isGuest");
  window.location.href = PAGES.login;
}

export {
  iniciarSesion,
  obtenerIdUsuario,
  obtenerNombreUsuario,
  esInvitado,
  iniciarSesionInvitado,
  cerrarSesion,
  API_URLS,
};
