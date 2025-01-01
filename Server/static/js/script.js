// Full screen canvas setup and graph initialization
function initializeGraph() {
    // Setup canvas dimensions
    const canvasElement = document.getElementById('graph-container');
    canvasElement.width = window.innerWidth;
    canvasElement.height = window.innerHeight;

    // Create and setup the graph
    const graph = new LGraph();
    const canvas = new LGraphCanvas("#graph-container", graph);
    
    // Create nodes
    const node1 = LiteGraph.createNode("basic/const");
    node1.pos = [100, 200];
    node1.setValue(42);
    graph.add(node1);

    const node2 = LiteGraph.createNode("basic/watch");
    node2.pos = [400, 200];
    graph.add(node2);

    // Connect nodes
    node1.connect(0, node2, 0);

    // Start the graph
    graph.start();
}

// Handle window resize
window.addEventListener('resize', function() {
    const canvas = document.getElementById('graph-container');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});

// Initialize when page loads
window.addEventListener('load', initializeGraph);
