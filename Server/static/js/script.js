// Initialize API and WebSocket clients
const apiClient = new ApiClient();
const wsClient = new WebSocketClient();

// Graph instance and canvas
let graph = null;
let canvas = null;

// Node mapping between LiteGraph and Neo4j
const nodeMap = new Map();

// Full screen canvas setup and graph initialization
async function initializeGraph() {
    // Setup canvas dimensions
    const canvasElement = document.getElementById('graph-container');
    canvasElement.width = window.innerWidth;
    canvasElement.height = window.innerHeight;

    // Create and setup the graph
    graph = new LGraph();
    canvas = new LGraphCanvas("#graph-container", graph);

    // Load initial data from Neo4j
    await loadGraphData();

    // Setup WebSocket listeners
    setupWebSocketListeners();

    // Setup LiteGraph event handlers
    setupGraphEventHandlers();

    // Start the graph
    graph.start();
}

async function loadGraphData() {
    try {
        const nodes = await apiClient.getNodes();
        nodes.forEach(node => {
            const lgNode = createLiteGraphNode(node);
            graph.add(lgNode);
            nodeMap.set(node.id, lgNode);
        });
    } catch (error) {
        console.error('Failed to load graph data:', error);
    }
}

function createLiteGraphNode(nodeData) {
    const node = LiteGraph.createNode("basic/watch");
    node.title = nodeData.labels.join(', ');
    node.properties = nodeData.properties;
    node.pos = [Math.random() * 500, Math.random() * 500];
    return node;
}

function setupWebSocketListeners() {
    wsClient.connect();

    wsClient.on('node_created', (nodeData) => {
        const lgNode = createLiteGraphNode(nodeData);
        graph.add(lgNode);
        nodeMap.set(nodeData.id, lgNode);
    });

    wsClient.on('node_updated', (nodeData) => {
        const lgNode = nodeMap.get(nodeData.id);
        if (lgNode) {
            lgNode.properties = nodeData.properties;
            lgNode.title = nodeData.labels.join(', ');
            lgNode.setDirtyCanvas(true, true);
        }
    });

    wsClient.on('node_deleted', (nodeData) => {
        const lgNode = nodeMap.get(nodeData.id);
        if (lgNode) {
            graph.remove(lgNode);
            nodeMap.delete(nodeData.id);
        }
    });
}

function setupGraphEventHandlers() {
    canvas.onNodeAdded = function(node) {
        apiClient.createNode(['CustomNode'], node.properties)
            .then(createdNode => {
                nodeMap.set(createdNode.id, node);
            })
            .catch(console.error);
    };

    canvas.onNodeRemoved = function(node) {
        const nodeId = [...nodeMap.entries()].find(([id, n]) => n === node)?.[0];
        if (nodeId) {
            apiClient.deleteNode(nodeId)
                .catch(console.error);
        }
    };

    canvas.onNodePropertyChanged = function(node, property, value) {
        const nodeId = [...nodeMap.entries()].find(([id, n]) => n === node)?.[0];
        if (nodeId) {
            const properties = { ...node.properties, [property]: value };
            apiClient.updateNode(nodeId, properties)
                .catch(console.error);
        }
    };

    canvas.onConnectionChange = function(linkInfo) {
        if (linkInfo.link) {
            const startNodeId = [...nodeMap.entries()].find(([id, n]) => n === linkInfo.link.origin.node)?.[0];
            const endNodeId = [...nodeMap.entries()].find(([id, n]) => n === linkInfo.link.target.node)?.[0];
            if (startNodeId && endNodeId) {
                apiClient.createRelationship(startNodeId, endNodeId, 'CONNECTS_TO', {})
                    .catch(console.error);
            }
        }
    };
}

// Handle window resize
window.addEventListener('resize', function() {
    const canvas = document.getElementById('graph-container');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});

// Initialize when page loads
window.addEventListener('load', initializeGraph);
