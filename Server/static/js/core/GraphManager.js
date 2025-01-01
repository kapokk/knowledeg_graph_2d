export default class GraphManager {
    constructor(apiClient, wsClient) {
        this.apiClient = apiClient;
        this.wsClient = wsClient;
        this.graph = null;
        this.canvas = null;
    }

    async initialize() {
        // Initialize graph and canvas
        this.graph = new LGraph();
        this.canvas = new LGraphCanvas("#graph-container", this.graph);
        this.graph.start();
    }

    handleWindowResize() {
        if (this.canvas) {
            this.canvas.canvas.width = window.innerWidth;
            this.canvas.canvas.height = window.innerHeight;
        }
    }
}
