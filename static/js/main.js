import GraphManager from './core/GraphManager.js';
import NodeManager from './core/NodeManager.js';
import ApiClient from './api/ApiClient.js';
import WebSocketClient from './api/WebSocketClient.js';
import KnowledgeGraphNode from './nodes/KnowledgeGraphNode.js';

// Register node type
LiteGraph.registerNodeType("knowledge/KnowledgeGraphNode", KnowledgeGraphNode);

// Initialize clients
const apiClient = new ApiClient();
const wsClient = new WebSocketClient();

// Initialize managers
const graphManager = new GraphManager();
const nodeManager = new NodeManager(apiClient);

async function initialize() {
    // Initialize graph
    graphManager.initialize();
    
    // Load initial data
    const nodes = await nodeManager.loadNodes();
    nodes.forEach(node => graphManager.addNode(node));

    // Setup WebSocket listeners
    setupWebSocketListeners();

    // Setup graph event handlers
    setupGraphEventHandlers();

    // Handle window resize
    window.addEventListener('resize', handleResize);
}

function setupWebSocketListeners() {
    wsClient.connect();

    wsClient.on('node_created', (nodeData) => {
        const lgNode = nodeManager.createNode(nodeData);
        graphManager.addNode(lgNode);
        nodeManager.nodeMap.set(nodeData.id, lgNode);
    });

    wsClient.on('node_updated', (nodeData) => {
        const lgNode = nodeManager.getNodeById(nodeData.id);
        if (lgNode) {
            lgNode.properties = nodeData.properties;
            lgNode.title = nodeData.labels.join(', ');
            lgNode.setDirtyCanvas(true, true);
        }
    });

    wsClient.on('node_deleted', (nodeData) => {
        const lgNode = nodeManager.getNodeById(nodeData.id);
        if (lgNode) {
            graphManager.removeNode(lgNode);
            nodeManager.removeNodeFromMap(nodeData.id);
        }
    });
}

function setupGraphEventHandlers() {
    graphManager.onNodeAdded(async (node) => {
        const createdNode = await nodeManager.createNodeInBackend(['CustomNode'], node.properties);
        nodeManager.nodeMap.set(createdNode.id, node);
    });

    graphManager.onNodeRemoved((node) => {
        const nodeId = [...nodeManager.nodeMap.entries()].find(([id, n]) => n === node)?.[0];
        if (nodeId) {
            nodeManager.deleteNode(nodeId);
        }
    });

    graphManager.onNodePropertyChanged((node, property, value) => {
        const nodeId = [...nodeManager.nodeMap.entries()].find(([id, n]) => n === node)?.[0];
        if (nodeId) {
            const properties = { ...node.properties, [property]: value };
            nodeManager.updateNode(nodeId, properties);
        }
    });

    graphManager.onConnectionChange((linkInfo) => {
        if (linkInfo.link) {
            const startNodeId = [...nodeManager.nodeMap.entries()].find(([id, n]) => n === linkInfo.link.origin.node)?.[0];
            const endNodeId = [...nodeManager.nodeMap.entries()].find(([id, n]) => n === linkInfo.link.target.node)?.[0];
            if (startNodeId && endNodeId) {
                apiClient.createRelationship(startNodeId, endNodeId, 'CONNECTS_TO', {});
            }
        }
    });
}

function handleResize() {
    const canvas = document.getElementById('graph-container');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

// Initialize when page loads
window.addEventListener('load', initialize);
