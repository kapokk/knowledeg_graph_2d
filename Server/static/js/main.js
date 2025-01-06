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
        this.apiClient = null; // 用于存储apiClient引用

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

            // 设置事件监听
            this.setupEventListeners();

             // 注册节点类型
            LiteGraph.registerNodeType("knowledge/KnowledgeGraphNode", KnowledgeGraphNode);

            // 初始化 WebSocket 连接
            this.wsClient.connect();
            
            // 初始化图实例
            await this.graphManager.initialize();
            
            // 加载初始数据
            await this.nodeManager.loadInitialData();
            
            

           

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

    async loadGraphData() {
        await this.nodeManager.loadInitialData();
        // NodeManager will handle adding nodes to the graph and maintaining nodeMap
    }

    setupWebSocketListeners() {
        this.wsClient.connect();
    
        this.wsClient.on('node_created', (nodeData) => {
            this.nodeManager.handleNodeCreated(nodeData);
        });
    
        this.wsClient.on('node_updated', (nodeData) => {
            this.nodeManager.handleNodeUpdated(nodeData);
        });
    
        this.wsClient.on('node_deleted', (nodeData) => {
            this.nodeManager.handleNodeDeleted(nodeData);
        });
    }
    
    setupGraphEventHandlers() {
        // 在 KnowledgeGraphNode 类中添加事件处理
        KnowledgeGraphNode.prototype.onAdded = function() {
            const labels = this.labels || ['CustomNode'];
            if (!this.apiClient) {
                console.error('API client not initialized');
                return;
            }
            
            this.apiClient.createNode(labels, this.properties)
                .then(createdNode => {
                    // 更新节点ID和属性
                    this.id = createdNode.id;
                    this.properties = createdNode.properties;
                    this.labels = createdNode.labels;
                    this.title = createdNode.labels.join(', ');
                    
                    // 更新控件
                    this.refreshControls();
                    
                    // 更新节点映射
                    if (this.graph && this.graph.app) {
                        this.graph.app.nodeMap.set(createdNode.id, this);
                    }
                })
                .catch(error => {
                    console.error('Failed to create node:', error);
                    alert('Failed to create node. Please try again.');
                });
        };

        KnowledgeGraphNode.prototype.onRemoved = ()=>{
            const nodeId = [...this.nodeMap.entries()].find(([id, n]) => n === this)?.[0];
            if (nodeId) {
                this.apiClient.deleteNode(nodeId)
                    .catch(console.error);
            }
        };

        KnowledgeGraphNode.prototype.onPropertyChanged = function(property, value) {
            if (!this.apiClient) {
                console.error('API client not initialized');
                return;
            }
            
            if (!this.id) {
                console.error('Node ID not found');
                return;
            }

            const properties = { ...this.properties, [property]: value };
            this.apiClient.updateNode(this.id, properties)
                .then(updatedNode => {
                    // 更新节点属性
                    this.properties = updatedNode.properties;
                    this.setDirtyCanvas(true, true);
                })
                .catch(error => {
                    console.error('Failed to update node:', error);
                    // 回滚属性更改
                    this.properties[property] = this.properties[property];
                    this.setDirtyCanvas(true, true);
                });
        };

        KnowledgeGraphNode.prototype.onConnectionsChange = (type, slot, connected, link_info, input_info)=> {
            if (connected && type === LiteGraph.OUTPUT) {
                const startNodeId = [...this.nodeMap.entries()].find(([id, n]) => n === this)?.[0];
                const endNodeId = [...this.nodeMap.entries()].find(([id, n]) => n === link_info.target.node)?.[0];
                if (startNodeId && endNodeId) {
                    this.apiClient.createRelationship(startNodeId, endNodeId, 'CONNECTS_TO', {})
                        .catch(console.error);
                }
            }
        };

        // 将应用实例和API客户端附加到节点
        KnowledgeGraphNode.prototype.onConfigure = function() {
            if (this.graph && this.graph.app) {
                this.app = this.graph.app;
                this.apiClient = this.graph.app.apiClient;
            }
        };
    }
    
}




// Removed createKnowledgeGraphNode since NodeManager handles this now


// 启动应用
document.addEventListener('DOMContentLoaded', () => {
    const app = new Application();
    app.initialize();
});
