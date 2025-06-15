function initCarousel() {
    const carousel = document.querySelector('.carousel');
    const container = document.getElementById('carouselContainer');
    const slides = document.querySelectorAll('.carousel-slide');
    const dots = document.querySelectorAll('.dot');
    let currentSlide = 0;

    function showSlide(n) {
        slides.forEach(slide => slide.style.display = 'none');
        dots.forEach(dot => dot.classList.remove('active'));

        slides[n].style.display = 'block';
        dots[n].classList.add('active');
    }

    function nextSlide() {
        currentSlide = (currentSlide + 1) % slides.length;
        showSlide(currentSlide);
    }

    dots.forEach((dot, index) => {
        dot.addEventListener('click', () => {
            currentSlide = index;
            showSlide(currentSlide);
        });
    });

    setInterval(nextSlide, 5000);
    showSlide(0);
}

document.addEventListener('DOMContentLoaded', () => {
    initCarousel();

    // Hamburger Menu Toggle
    const hamburger = document.querySelector('.hamburger');
    const menu = document.querySelector('.menu');

    if (hamburger && menu) {
        hamburger.addEventListener('click', () => {
            menu.classList.toggle('active');
        });
    }

    // Fade-in Animation for Sections
    const sections = document.querySelectorAll('.fade-in');
    const observerOptions = {
        threshold: 0.2,
        rootMargin: '0px',
    };

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    sections.forEach((section) => {
        observer.observe(section);
    });
});
