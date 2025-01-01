// Custom Knowledge Graph Node
class KnowledgeGraphNode extends LGraphNode {
    constructor() {
        super();
        this.title = "Knowledge Graph Node";
        this.size = [300, 200];

        // 初始化标签和属性
        this.labels = ["Node"]; // 默认标签
        this.properties = {};   // 默认属性

        // 添加输入和输出端口
        this.addInput("", "");  // 通用输入端口
        this.addOutput("", ""); // 通用输出端口

        // 添加 UI 控件
        this.addLabelsControl();
        this.addPropertiesControl();
        this.refreshControls();
    }

    // 添加标签控件
    addLabelsControl() {
        // 如果控件已经存在，先移除
        if (this.labelsWidget) {
            this.removeWidget(this.labelsWidget);
        }
        // 添加新的控件
        this.labelsWidget = this.addWidget("text", "Labels", this.labels.join(", "), (value) => {
            this.labels = value.split(",").map(label => label.trim());
        });
    }

    // 添加属性控件
    addPropertiesControl() {
        // 移除所有现有的属性控件
        if (this.propertyWidgets) {
            this.propertyWidgets.forEach(widget => this.removeWidget(widget));
        }
        this.propertyWidgets = [];

        // 添加属性控件
        for (const key in this.properties) {
            const widget = this.addPropertyWidget(key, this.properties[key]);
            this.propertyWidgets.push(widget);
        }

        // 添加 "Add Property" 按钮
        this.addPropertyButton = this.addWidget("button", "Add Property", "", () => {
            const key = prompt("Enter property key:");
            if (key) {
                const value = prompt("Enter property value:");
                this.properties[key] = value;
                this.addPropertyWidget(key, value);
                this.setSize([this.size[0], this.size[1] + 30]); // 调整节点大小
            }
        });
    }

    // 添加属性控件
    addPropertyWidget(key, value) {
        const widget = this.addWidget("text", key, value, (newValue) => {
            this.properties[key] = newValue;
        });
        this.propertyWidgets.push(widget);
        return widget;
    }

    // 节点执行逻辑
    onExecute() {
        // 这里可以处理节点的逻辑，例如根据输入更新输出
        const inputData = this.getInputData(0);
        this.setOutputData(0, inputData);
    }

    // 序列化节点
    serialize() {
        return {
            labels: this.labels,
            properties: this.properties
        };
    }

    // 反序列化节点
    deserialize(data) {
        this.labels = data.labels || ["Node"];
        this.properties = data.properties || {};
        this.refreshControls();
    }

    // 刷新控件
    refreshControls() {
        this.addLabelsControl();
        this.addPropertiesControl();
        this.setDirtyCanvas(true, true); // 强制刷新界面
    }
}

// 注册节点类型
LiteGraph.registerNodeType("knowledge/KnowledgeGraphNode", KnowledgeGraphNode);

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
            const lgNode = createKnowledgeGraphNode(node);
            graph.add(lgNode);
            nodeMap.set(node.id, lgNode);
        });
    } catch (error) {
        console.error('Failed to load graph data:', error);
    }
}

function createKnowledgeGraphNode(nodeData) {
    const node = LiteGraph.createNode("knowledge/KnowledgeGraphNode");
    node.title = nodeData.labels.join(', ');
    node.properties = nodeData.properties;
    node.pos = [Math.random() * 500, Math.random() * 500];
    return node;
}

function setupWebSocketListeners() {
    wsClient.connect();

    wsClient.on('node_created', (nodeData) => {
        const lgNode = createKnowledgeGraphNode(nodeData);
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
