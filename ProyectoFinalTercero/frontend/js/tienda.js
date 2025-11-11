function createParticles() {
    const particlesContainer = document.getElementById('particles');
    if (!particlesContainer) return;
    
    const particleCount = 50;

    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.top = Math.random() * 100 + '%';
        particle.style.animationDelay = Math.random() * 15 + 's';
        particle.style.animationDuration = (Math.random() * 10 + 10) + 's';
        particlesContainer.appendChild(particle);
    }
}

function filterProducts(category) {
    const products = document.querySelectorAll('.product-card');
    const filterBtns = document.querySelectorAll('.filter-btn');

    filterBtns.forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');

    products.forEach(product => {
        if (category === 'todos' || product.dataset.category === category) {
            product.style.display = 'block';
            setTimeout(() => {
                product.classList.add('visible');
            }, 100);
        } else {
            product.classList.remove('visible');
            setTimeout(() => {
                product.style.display = 'none';
            }, 300);
        }
    });
}

// Datos de productos para el modal
const productData = {
    producto1: {
        name: 'Remera Oficial ICESTUDIO',
        description: 'Remera de algodón premium con logo bordado de alta calidad',
        price: '$590',
        image: './img/remera.png',
        features: [
            '100% algodón peinado',
            'Logo bordado en el pecho',
            'Corte unisex',
            'Talles disponibles: S, M, L, XL, XXL',
            'Colores: Negro, Blanco, Gris'
        ]
    },
    remera: {
        name: 'Remera Básica ICESTUDIO',
        description: '100% Algodón, logo estampado de alta calidad',
        price: '$590',
        image: './img/remera.png',
        features: [
            '100% algodón premium',
            'Logo ICESTUDIO estampado',
            'Corte regular unisex',
            'Talles: S, M, L, XL, XXL',
            'Colores: Negro, Blanco',
            'Tela suave y transpirable'
        ]
    },
    buzo: {
        name: 'Buzo con Capucha ICESTUDIO',
        description: 'Buzo canguro blanco con diseño exclusivo del pingüino ICESTUDIO',
        price: '$1.290',
        image: './img/canguro.png',
        features: [
            'Polar premium 320gsm',
            'Diseño frontal: Logo ICESTUDIO',
            'Diseño trasero: Pingüino con auriculares en iceberg',
            'Capucha ajustable con cordón',
            'Bolsillo canguro grande',
            'Talles: S, M, L, XL, XXL',
            'Color: Blanco'
        ]
    },
    termo: {
        name: 'Termo ICESTUDIO',
        description: 'Termo blanco de acero inoxidable con logo ICESTUDIO grabado',
        price: '$890',
        image: './img/termo.png',
        features: [
            'Acero inoxidable de doble pared',
            'Capacidad: 1 litro',
            'Mantiene temperatura 24+ horas',
            'Logo ICESTUDIO grabado con colores',
            'Acabado blanco mate premium',
            'Pico cebador incluido',
            'Apto para mate y bebidas calientes'
        ]
    },
    taza: {
        name: 'Taza ICESTUDIO',
        description: 'Taza blanca de cerámica con diseño del pingüino ICESTUDIO',
        price: '$390',
        image: './img/taza.png',
        features: [
            'Cerámica de alta calidad',
            'Capacidad: 350ml (11oz)',
            'Diseño: Pingüino con auriculares en iceberg',
            'Impresión de alta definición',
            'Apto para lavavajillas y microondas',
            'Acabado brillante',
            'Color: Blanco'
        ]
    },
    cuaderno: {
        name: 'Cuaderno A5 ICESTUDIO',
        description: 'Cuaderno anillado con tapa dura y diseño del pingüino ICESTUDIO',
        price: '$290',
        image: './img/cuadernoa5.png',
        features: [
            'Tapa dura resistente',
            '200 páginas de 80g',
            'Anillado espiral metálico',
            'Formato A5 (14.8 x 21 cm)',
            'Diseño de tapa: Pingüino ICESTUDIO en iceberg',
            'Logo ICESTUDIO con auriculares en la parte inferior',
            'Papel de alta calidad'
        ]
    },
    stickers: {
        name: 'Pack de Stickers ICESTUDIO',
        description: 'Pack de 10 stickers impermeables con diseños exclusivos del pingüino',
        price: '$150',
        image: './img/stickers.png',
        features: [
            '10 stickers circulares distintos',
            'Material impermeable vinílico',
            'Alta resistencia UV',
            'Diseño: Pingüino ICESTUDIO en iceberg',
            'Fondo gris oscuro con efecto peeling',
            'Fácil aplicación en cualquier superficie',
            'Ideal para laptops, notebooks y botellas'
        ]
    }
};

function openProductModal(productId) {
    const product = productData[productId];
    if (!product) return;

    document.getElementById('modalProductName').textContent = product.name;
    document.getElementById('modalProductDescription').textContent = product.description;
    document.getElementById('modalProductPrice').textContent = product.price;
    
    const modalImage = document.getElementById('modalProductImage');
    modalImage.src = product.image;
    modalImage.alt = product.name;
    
    const featuresList = document.getElementById('modalProductFeatures');
    featuresList.innerHTML = '';
    product.features.forEach(feature => {
        const li = document.createElement('li');
        li.innerHTML = `<i class="fas fa-check-circle"></i> ${feature}`;
        featuresList.appendChild(li);
    });

    document.getElementById('productModal').dataset.productName = product.name;

    document.getElementById('productModal').style.display = 'flex';
}

function closeProductModal() {
    document.getElementById('productModal').style.display = 'none';
}

function contactFromModal() {
    const productName = document.getElementById('productModal').dataset.productName;
    contactWhatsApp(productName);
}

function contactWhatsApp(productName) {
    const instagramUrl = 'https://www.instagram.com/';
    const message = `Hola! Estoy interesado en: ${productName}`;
    
    window.open(instagramUrl, '_blank');
}

function handleScrollAnimations() {
    const elements = document.querySelectorAll('.fade-in');
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, {
        threshold: 0.1
    });

    elements.forEach(element => {
        observer.observe(element);
    });
}

window.onclick = function(event) {
    const modal = document.getElementById('productModal');
    if (event.target === modal) {
        closeProductModal();
    }
}

document.addEventListener('DOMContentLoaded', function() {
    createParticles();
    handleScrollAnimations();
    
    setTimeout(() => {
        document.querySelectorAll('.fade-in').forEach(element => {
            const rect = element.getBoundingClientRect();
            if (rect.top < window.innerHeight) {
                element.classList.add('visible');
            }
        });
    }, 100);
});