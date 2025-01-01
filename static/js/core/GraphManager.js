class GraphManager {
    constructor() {
        this.graph = null;
        this.canvas = null;
    }

    initialize() {
        // Setup canvas dimensions
        const canvasElement = document.getElementById('graph-container');
        canvasElement.width = window.innerWidth;
        canvasElement.height = window.innerHeight;

        // Create and setup the graph
        this.graph = new LGraph();
        this.canvas = new LGraphCanvas("#graph-container", this.graph);

        // Start the graph
        this.graph.start();
    }

    onNodeAdded(callback) {
        this.canvas.onNodeAdded = callback;
    }

    onNodeRemoved(callback) {
        this.canvas.onNodeRemoved = callback;
    }

    onNodePropertyChanged(callback) {
        this.canvas.onNodePropertyChanged = callback;
    }

    onConnectionChange(callback) {
        this.canvas.onConnectionChange = callback;
    }

    addNode(node) {
        this.graph.add(node);
    }

    removeNode(node) {
        this.graph.remove(node);
    }
}

export default GraphManager;
