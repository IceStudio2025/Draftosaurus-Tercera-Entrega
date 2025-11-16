"use strict";

import { PAGES } from "./auth.js";

// Función para obtener la URL base de la API
const getApiBase = () => window.getApiBase ? window.getApiBase() : "http://localhost:8000";
const REGISTER_API = () => `${getApiBase()}/api/auth/register`;

document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("form_registro");
  const mensajeError = document.getElementById("mensaje_error");
  const checkboxVer = document.getElementById("ver_password");
  const inputPassword = document.getElementById("password");
  const inputconfirm = document.getElementById("confirm");

  form.addEventListener("submit", async function (e) {
    e.preventDefault();

    const nombre = document.getElementById("nombre").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const confirm = document.getElementById("confirm").value;

    if (!nombre || !email || !password || !confirm) {
      mostrarError("Todos los campos son obligatorios.");
      return;
    }

    if (nombre.length < 3) {
      mostrarError("El nombre de usuario debe tener al menos 3 caracteres.");
      return;
    }

    if (!validarEmail(email)) {
      mostrarError("Por favor ingresa un correo electrónico válido.");
      return;
    }

    if (password.length < 6) {
      mostrarError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    if (password !== confirm) {
      mostrarError("Las contraseñas deben coincidir");
      return;
    }

    mostrarMensaje("Enviando registro...", "orange");

    try {
      const response = await fetch(REGISTER_API(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: nombre,
          email: email,
          password: password,
        }),
      });

      const data = await response.json();

      if (data.success) {
        mostrarMensaje("¡Registro exitoso! Redirigiendo al login...", "green");

        setTimeout(() => {
          window.location.href = PAGES.login;
        }, 2000);
      } else {
        console.log("Error del servidor:", data.message);

        if (data.code === "duplicate" && data.message.includes("username")) {
          mostrarError("Este nombre de usuario ya está registrado. Por favor elige otro.");
        } else if (data.code === "duplicate" && data.message.includes("email")) {
          mostrarError("Este correo electrónico ya está registrado. ¿Olvidaste tu contraseña?");
        } else if (data.code === "invalid") {
          mostrarError("Por favor verifica los datos proporcionados.");
        } else {
          mostrarError("No se pudo completar el registro. Por favor inténtalo más tarde.");
        }
      }
    } catch (error) {
      console.error("Error al registrar:", error);
      mostrarError("No pudimos procesar tu solicitud en este momento. Por favor, inténtalo de nuevo más tarde.");
    }

    function mostrarError(mensaje) {
      mensajeError.textContent = mensaje;
      mensajeError.style.color = "red";
    }

    function mostrarMensaje(mensaje, color) {
      mensajeError.textContent = mensaje;
      mensajeError.style.color = color;
    }

    function validarEmail(email) {
      const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return re.test(email);
    }
  });

  checkboxVer.addEventListener("change", function () {
    if (checkboxVer.checked) {
      inputPassword.type = "text";
      inputconfirm.type = "text";
    } else {
      inputPassword.type = "password";
      inputconfirm.type = "password";
    }
  });

  const inputs = form.querySelectorAll("input");
  inputs.forEach((input) => {
    input.addEventListener("input", function () {
      if (mensajeError.textContent !== "") {
        mensajeError.textContent = "";
      }
    });
  });
});
