"use strict";

import { obtenerNombreUsuario, cerrarSesion, esInvitado, PAGES } from "./auth.js";

document.addEventListener("DOMContentLoaded", function () {
  mostrarNombreUsuario();
  configurarBotones();
  mostrarMensajesURL();
  configurarModoInvitado();
});

function mostrarNombreUsuario() {
  const nombreUsuarioElement = document.getElementById("nombre-usuario");
  if (!nombreUsuarioElement) return;
  const username = obtenerNombreUsuario();
  
  // Verificar si ya tiene un span, si no, crear la estructura
  let span = nombreUsuarioElement.querySelector('span');
  if (!span) {
    nombreUsuarioElement.innerHTML = `<i class="fas fa-user-circle"></i> <span>${username || "Jugador"}</span>`;
  } else {
    span.textContent = username || "Jugador";
  }
}

function configurarBotones() {
  const userButton = document.getElementById("nombre-usuario");
  const dropdown = document.getElementById("userDropdown");
  if (userButton && dropdown) {
    userButton.addEventListener("click", (e) => {
      e.stopPropagation();
      dropdown.classList.toggle("active");
    });
    document.addEventListener("click", (event) => {
      if (!userButton.contains(event.target) && !dropdown.contains(event.target)) {
        dropdown.classList.remove("active");
      }
    });
  }

  const btnLogout = document.getElementById("btn-logout");
  if (btnLogout) {
    btnLogout.addEventListener("click", (e) => {
      e.preventDefault();
      cerrarSesion();
    });
  }

  const btnNuevo = document.getElementById("btn-nuevo-juego");
  if (btnNuevo) {
    btnNuevo.addEventListener("click", (e) => {
      e.preventDefault();
      window.location.href = PAGES.seleccionarOponente || "./partidarapida.html";
    });
  }

  const btnVolverJugar = document.getElementById("btn-volver-jugar");
  if (btnVolverJugar) {
    btnVolverJugar.addEventListener("click", (e) => {
      e.preventDefault();
      // Redirigir al menú principal ya que volverajugar.html fue eliminado
      window.location.href = PAGES.menu;
    });
  }

  const btnHistorial = document.getElementById("btn-historial");
  if (btnHistorial) {
    btnHistorial.addEventListener("click", (e) => {
      e.preventDefault();
      window.location.href = "./historial.html";
    });
  }

  const btnManual = document.getElementById("btn-manual");
  if (btnManual) {
    btnManual.addEventListener("click", (e) => {
      e.preventDefault();
      window.location.href = "./manual.html";
    });
  }

  document.getElementById("btn-jugar")?.addEventListener("click", () => {
    window.location.href = PAGES.seleccionarOponente;
  });

}

function mostrarMensajesURL() {
  const params = new URLSearchParams(window.location.search);
  const mensaje = params.get("mensaje");
  if (!mensaje) return;

  const mensajeElement = document.getElementById("mensaje-sistema");
  if (mensajeElement) {
    mensajeElement.textContent = mensaje;
    mensajeElement.style.display = "block";
    setTimeout(() => (mensajeElement.style.display = "none"), 5000);
  } else {
    alert(mensaje);
  }
}

function configurarModoInvitado() {
  const isGuest = esInvitado();
  
  if (isGuest) {
    // Ocultar/deshabilitar opciones no permitidas para invitados
    const btnNuevoJuego = document.getElementById("btn-nuevo-juego");
    const btnCreaJuego = document.getElementById("btn-crea-juego");
    const btnHistorial = document.getElementById("btn-historial");
    
    if (btnNuevoJuego) {
      btnNuevoJuego.style.display = "none";
    }
    
    if (btnCreaJuego) {
      btnCreaJuego.style.display = "none";
    }
    
    if (btnHistorial) {
      btnHistorial.style.display = "none";
    }
    
    // Mostrar mensaje informativo
    const mensajeElement = document.getElementById("mensaje-sistema");
    if (mensajeElement) {
      mensajeElement.textContent = "Modo Invitado: Solo puedes unirte a salas con código";
      mensajeElement.style.display = "block";
      mensajeElement.style.backgroundColor = "#ffc107";
      mensajeElement.style.color = "#000";
      setTimeout(() => (mensajeElement.style.display = "none"), 5000);
    }
    
    // Actualizar nombre de usuario para mostrar que es invitado
    const nombreUsuarioElement = document.getElementById("nombre-usuario");
    if (nombreUsuarioElement) {
      const span = nombreUsuarioElement.querySelector('span');
      if (span) {
        span.textContent = obtenerNombreUsuario() + " (Invitado)";
      }
    }
  }
}
