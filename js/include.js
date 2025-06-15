document.addEventListener('DOMContentLoaded', () => {
    // Hamburger Menu Toggle
    const hamburger = document.querySelector('.hamburger');
    const menu = document.querySelector('.menu');

    if (hamburger && menu) {
        hamburger.addEventListener('click', () => {
            menu.classList.toggle('active');
        });
    }

    // Automatically load footer for pages with #footer element
    const footerElement = document.getElementById('footer');
    if (footerElement) {
        loadHTML('footer', '../footer.html');
    }
});

// Hàm load HTML
async function loadHTML(elementId, url) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.text();
        const element = document.getElementById(elementId);
        if (element) {
            element.innerHTML = data;
        } else {
            throw new Error(`Element with ID ${elementId} not found`);
        }
        
        // Initialize components after loading
        if (elementId === 'bando') initBandoComponent();
        if (elementId === 'tour') initTourComponent();
        if (elementId === 'why') initWhyComponent();
    } catch (error) {
        console.error(`Error loading ${url} into ${elementId}:`, error);
    }
}

// Hàm load Scripts
async function loadScripts(scripts) {
    for (let src of scripts) {
        try {
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = src;
                script.async = true;
                script.onload = resolve;
                script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
                document.body.appendChild(script);
            });
        } catch (error) {
            console.error(error);
        }
    }
}

// Placeholder Component Initialization Functions
function initBandoComponent() {
    // Placeholder for initializing the 'bando' component (e.g., interactive map)
    console.log('initBandoComponent: Initializing bando component');
    // Add actual logic here (e.g., Leaflet map setup, if not handled elsewhere)
}

function initTourComponent() {
    // Placeholder for initializing the 'tour' component (e.g., carousel or tour section)
    console.log('initTourComponent: Initializing tour component');
    // Add actual logic here (e.g., Bootstrap carousel initialization)
}

function initWhyComponent() {
    // Placeholder for initializing the 'why' component (e.g., why section content)
    console.log('initWhyComponent: Initializing why component');
    // Add actual logic here (e.g., animations or dynamic content)
}