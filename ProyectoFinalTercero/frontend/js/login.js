const showMessage = (elementInput, success, message) => {
  if (success) {
    elementInput.classList.add("success");
    elementInput.style.backgroundColor = "#090";
    elementInput.style.padding = "5px 0 5px 7px";
    elementInput.innerHTML =
      "<p> " + message + " <p><button class='exitMessage'>X</button>";
  } else {
    elementInput.classList.add("success");
    elementInput.style.backgroundColor = "#900";
    elementInput.style.padding = "5px 0 5px 7px";
    elementInput.innerHTML =
      "<p>" + message + "<p><button class='exitMessage'>X</button>";
  }
};

const showPassword = (input, showPass) => {
  showPass.addEventListener("change", function () {
    input.type = this.checked ? "text" : "password";
  });
};

import { iniciarSesion, iniciarSesionInvitado } from "./auth.js";

window.addEventListener("load", () => {
  const input = document.getElementById("password");
  const showPass = document.getElementById("showPass");
  const elementInput = document.getElementById("showMessage");

  const form = document.getElementById("submit");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      elementInput.innerHTML = "";
      elementInput.classList.remove("success");

      showMessage(elementInput, true, "Iniciando sesión...");

      const identifier = document.getElementById("email").value;
      const password = input.value;

      if (!identifier || !password) {
        showMessage(elementInput, false, "Todos los campos son obligatorios");
        return;
      }

      const result = await iniciarSesion(identifier, password);

      if (!result.success) {
        let mensajeError = result.message || "Credenciales inválidas. Verifica tus datos.";

        if (result.error === "parse_error") {
          mensajeError += " (Error de formato en la respuesta)";
        }

        showMessage(elementInput, false, mensajeError);
        return;
      }

      showMessage(elementInput, true, "Login exitoso! Redirigiendo...");
      setTimeout(() => {
        window.location.href = "menujugador.html";
      }, 1000);
    } catch (error) {
      console.error("Error al iniciar sesión:", error);
      showMessage(elementInput, false, "Error de conexión. Inténtalo nuevamente más tarde.");
    }
  });

  elementInput.addEventListener("click", (e) => {
    if (e.target.classList.contains("exitMessage")) {
      elementInput.innerHTML = "";
      elementInput.classList.remove("success");
      elementInput.style.backgroundColor = "";
    }
  });

  showPassword(input, showPass);

  // Configurar botón de modo invitado
  const btnGuest = document.getElementById("btn-guest-mode");
  if (btnGuest) {
    btnGuest.addEventListener("click", async (e) => {
      e.preventDefault();
      try {
        elementInput.innerHTML = "";
        elementInput.classList.remove("success");

        showMessage(elementInput, true, "Iniciando sesión como invitado...");

        const result = await iniciarSesionInvitado();

        if (!result.success) {
          showMessage(elementInput, false, result.message || "Error al iniciar sesión como invitado");
          return;
        }

        showMessage(elementInput, true, "¡Bienvenido como invitado! Redirigiendo...");
        setTimeout(() => {
          window.location.href = "menujugador.html";
        }, 1000);
      } catch (error) {
        console.error("Error al iniciar sesión como invitado:", error);
        showMessage(elementInput, false, "Error al iniciar sesión como invitado");
      }
    });
  }
});
