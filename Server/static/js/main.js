import GraphManager from './core/GraphManager.js';
import NodeManager from './core/NodeManager.js';
import ApiClient from './api/ApiClient.js';
import WebSocketClient from './api/WebSocketClient.js';



class KnowledgeGraphNode extends LGraphNode {
    constructor(node) {
        super();

        let labels = node.labels
        let properties = node.properties
        this.title = "Knowledge Graph Node";
        this.size = [300, 200];

        // 初始化标签和属性
        this.labels = Array.isArray(labels) ? labels : [labels]; // 确保 labels 是数组
        this.properties = properties || {};   // 使用传入的属性或默认空对象

        // 添加输入和输出端口
        this.addInput("", "");  // 通用输入端口
        this.addOutput("", ""); // 通用输出端口

        // 添加 UI 控件
        this.addLabelsControl();
        this.addPropertiesControl();
        //this.refreshControls();
    }

    // 添加标签控件
    addLabelsControl() {

        // 添加新的控件
        this.labelsWidget = this.addWidget("text", "Labels", this.labels.join(", "), (value) => {
            this.labels = value.split(",").map(label => label.trim());
        });
    }

    // 添加属性控件
    addPropertiesControl() {

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

class Application {
    constructor() {
        // 初始化 API 客户端
        this.apiClient = new ApiClient();
        
        // 初始化 WebSocket 客户端
        this.wsClient = new WebSocketClient();
        
        // 初始化图管理器
        this.graphManager = new GraphManager(this.apiClient, this.wsClient);
        
        // 初始化节点管理器
        this.nodeManager = new NodeManager(this.apiClient, this.wsClient);

        // 初始化图和画布
        this.graph = null;
        this.canvas = null;
        this.nodeMap = new Map();
    }

    async initialize() {
        try {
            // 初始化 WebSocket 连接
            this.wsClient.connect();
            
            // 初始化图实例
            await this.graphManager.initialize();
            
            // 加载初始数据
            await this.nodeManager.loadInitialData();
            
            // 设置事件监听
            this.setupEventListeners();

            // 初始化画布和图形
            await this.initializeGraph();
            
            console.log('Application initialized successfully');
        } catch (error) {
            console.error('Failed to initialize application:', error);
        }
    }

    async initializeGraph() {
        // Setup canvas dimensions
        const canvasElement = document.getElementById('graph-container');
        canvasElement.width = window.innerWidth;
        canvasElement.height = window.innerHeight;

        // Create and setup the graph
        this.graph = new LGraph();
        this.canvas = new LGraphCanvas("#graph-container", this.graph);

        // Load initial data from Neo4j
        await this.loadGraphData();

        // Setup WebSocket listeners
        this.setupWebSocketListeners();

        // Setup LiteGraph event handlers
        this.setupGraphEventHandlers();

        // Start the graph
        this.graph.start();
    }

    setupEventListeners() {
        // WebSocket 事件监听
        this.wsClient.on('node_created', (nodeData) => {
            this.nodeManager.handleNodeCreated(nodeData);
        });

        this.wsClient.on('node_updated', (nodeData) => {
            this.nodeManager.handleNodeUpdated(nodeData);
        });

        this.wsClient.on('node_deleted', (nodeData) => {
            this.nodeManager.handleNodeDeleted(nodeData);
        });

        // 窗口大小变化事件
        window.addEventListener('resize', () => {
            this.graphManager.handleWindowResize();
        });
    }
}


async function loadGraphData() {
    try {
        const nodes = await this.apiClient.getNodes();
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
    const node = LiteGraph.createNode("knowledge/KnowledgeGraphNode", nodeData);
    node.title = nodeData.labels.join(', ');
    node.pos = [Math.random() * 500, Math.random() * 500];
    return node;
}

function setupWebSocketListeners() {
    this.wsClient.connect();

    this.wsClient.on('node_created', (nodeData) => {
        const lgNode = createKnowledgeGraphNode(nodeData);
        graph.add(lgNode);
        nodeMap.set(nodeData.id, lgNode);
    });

    this.wsClient.on('node_updated', (nodeData) => {
        const lgNode = nodeMap.get(nodeData.id);
        if (lgNode) {
            lgNode.properties = nodeData.properties;
            lgNode.title = nodeData.labels.join(', ');
            lgNode.setDirtyCanvas(true, true);
        }
    });

    this.wsClient.on('node_deleted', (nodeData) => {
        const lgNode = nodeMap.get(nodeData.id);
        if (lgNode) {
            graph.remove(lgNode);
            nodeMap.delete(nodeData.id);
        }
    });
}

function setupGraphEventHandlers() {
    canvas.onNodeAdded = function(node) {
        this.appClient.createNode(['CustomNode'], node.properties)
            .then(createdNode => {
                nodeMap.set(createdNode.id, node);
            })
            .catch(console.error);
    };

    canvas.onNodeRemoved = function(node) {
        const nodeId = [...nodeMap.entries()].find(([id, n]) => n === node)?.[0];
        if (nodeId) {
            this.appClient.deleteNode(nodeId)
                .catch(console.error);
        }
    };

    canvas.onNodePropertyChanged = function(node, property, value) {
        const nodeId = [...nodeMap.entries()].find(([id, n]) => n === node)?.[0];
        if (nodeId) {
            const properties = { ...node.properties, [property]: value };
            this.appClient.updateNode(nodeId, properties)
                .catch(console.error);
        }
    };

    canvas.onConnectionChange = function(linkInfo) {
        if (linkInfo.link) {
            const startNodeId = [...nodeMap.entries()].find(([id, n]) => n === linkInfo.link.origin.node)?.[0];
            const endNodeId = [...nodeMap.entries()].find(([id, n]) => n === linkInfo.link.target.node)?.[0];
            if (startNodeId && endNodeId) {
                this.appClient.createRelationship(startNodeId, endNodeId, 'CONNECTS_TO', {})
                    .catch(console.error);
            }
        }
    };
}

// 启动应用
document.addEventListener('DOMContentLoaded', () => {
    const app = new Application();
    app.initialize();
});
