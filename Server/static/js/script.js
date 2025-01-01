// Adjust canvas size on window resize
window.addEventListener('resize', function() {
    const canvas = document.getElementById('graph-container');
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
});

// Initial canvas size setup
window.addEventListener('load', function() {
    const canvas = document.getElementById('graph-container');
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
});
