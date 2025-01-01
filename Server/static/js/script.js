// Full screen canvas setup
function setupCanvas() {
    const canvas = document.getElementById('graph-container');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

// Handle window resize
window.addEventListener('resize', setupCanvas);

// Initial setup
window.addEventListener('load', setupCanvas);
