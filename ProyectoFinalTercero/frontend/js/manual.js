import { obtenerNombreUsuario, cerrarSesion } from './auth.js';

document.addEventListener('DOMContentLoaded', function() {
    mostrarNombreUsuario();
    configurarDropdown();
});

function mostrarNombreUsuario() {
    const userButton = document.getElementById('nombre-usuario');
    if (!userButton) return;
    
    const username = obtenerNombreUsuario();
    if (username) {
        // Verificar si ya tiene un span, si no, crear la estructura
        let span = userButton.querySelector('span');
        if (!span) {
            userButton.innerHTML = `<i class="fas fa-user-circle"></i> <span>${username}</span>`;
        } else {
            span.textContent = username;
        }
    } else {
        // Si no hay username, mostrar "Usuario"
        let span = userButton.querySelector('span');
        if (!span) {
            userButton.innerHTML = `<i class="fas fa-user-circle"></i> <span>Usuario</span>`;
        } else {
            span.textContent = 'Usuario';
        }
    }
}

function configurarDropdown() {
    const userButton = document.getElementById('nombre-usuario');
    const dropdown = document.getElementById('userDropdown');
    const btnLogout = document.getElementById('btn-logout');
    
    if (!userButton || !dropdown) return;
    
    userButton.addEventListener('click', function(e) {
        e.stopPropagation();
        dropdown.classList.toggle('active');
    });

    document.addEventListener('click', function(e) {
        if (!userButton.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.remove('active');
        }
    });
    
    if (btnLogout) {
        btnLogout.addEventListener('click', function(e) {
            e.preventDefault();
            cerrarSesion();
        });
    }
}
