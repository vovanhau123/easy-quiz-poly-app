class ParticleEffect {
    constructor() {
        this.container = document.querySelector('.particles');
        this.particleCount = 50;
        this.init();
    }

    init() {
        for (let i = 0; i < this.particleCount; i++) {
            this.createParticle();
        }
    }

    createParticle() {
        const particle = document.createElement('div');
        particle.className = 'particle';
        
        // Random size
        const size = Math.random() * 5 + 2;
        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;
        
        // Random position
        particle.style.left = `${Math.random() * 100}%`;
        particle.style.top = `${Math.random() * 100}%`;
        
        // Random animation duration
        const duration = Math.random() * 3 + 2;
        particle.style.animationDuration = `${duration}s`;
        
        // Add to container
        this.container.appendChild(particle);
        
        // Remove and recreate particle after animation
        particle.addEventListener('animationend', () => {
            particle.remove();
            this.createParticle();
        });
    }
}

// Initialize particles
document.addEventListener('DOMContentLoaded', () => {
    new ParticleEffect();
}); 