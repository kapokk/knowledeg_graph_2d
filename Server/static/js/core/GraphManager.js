import { UiManager } from './UiManager.js';
export default class GraphManager {
    constructor(apiClient, wsClient,nodeManager) {
        this.apiClient = apiClient;
        this.wsClient = wsClient;
        this.graph = null;
        this.canvas = null;
        this.nodeManager = nodeManager
        
        this.initialize();

        this.uiManager = new UiManager(this.canvas,this.apiClient);
    }

    async initialize() {
        
        // Initialize graph and canvas
        this.graph = new LGraph();

        const canvasElement = document.getElementById('graph-container');
        canvasElement.width = window.innerWidth;
        canvasElement.height = window.innerHeight;
        this.canvas = new LGraphCanvas("#graph-container", this.graph);
        this.graph.start();
        this.nodeManager.graph = this.graph

        KnowledgeGraphNode.prototype.nodeManager = this.nodeManager
        LiteGraph.registerNodeType("knowledge/KnowledgeGraphNode", KnowledgeGraphNode);

        // 设置事件监听
        //this.setupEventListeners();
         // 初始化 WebSocket 连接
        // this.wsClient.connect();
        // Setup WebSocket listeners
        //this.setupWebSocketListeners();
        
        await this.loadGraphData();
        this.setupGraphEventHandlers();
        

        
    }

    setupGraphEventHandlers() {
        let application = this

        // 使用 LiteGraph 的事件系统
        this.graph.onNodeAdded = (node) => {
            
            if (node instanceof KnowledgeGraphNode) {
                this.nodeManager.handleNodeAdded(node);
                node.refreshControls();
            }
        };

        this.graph.onNodeRemoved = (node) => {
            if (node instanceof KnowledgeGraphNode) {
                this.nodeManager.handleNodeRemoved(node);
            }
        };

        // 自定义属性变化处理
        KnowledgeGraphNode.prototype.onPropertyChanged = function(property, value) {
            

            if (property == "Labels") { 
                this.labels = value.split(",").map(label => label.trim());
                application.nodeManager.handlePropertyChanged(this, property, value);
            }
            else{
                this.properties[property] = value;
                application.nodeManager.handlePropertyChanged(this, property, value);
            }
        };

        // 连接变化处理
        KnowledgeGraphNode.prototype.onConnectionsChange = async function(type, slot, isConnected, link_info, input_info) {
            const node = this;
            if (node instanceof KnowledgeGraphNode) {
                // 处理连接创建
                if (isConnected && type === LiteGraph.OUTPUT) {
                    const startNode = node;
                    const endNode = application.nodeManager.nodeMap.get(link_info.target_id)
                    if (endNode instanceof KnowledgeGraphNode) {
                        res_link = await application.nodeManager.handleConnectionsChange(
                            startNode,
                            type,
                            slot,
                            isConnected,
                            {
                                origin_id: startNode.id,
                                origin_slot: link_info.origin_slot,
                                target_id: endNode.id,
                                target_slot: link_info.target_slot,
                                type: link_info.type || "",
                                label: link_info.type || "CONNECTS_TO"  // 添加标签
                            },
                            input_info
                        );
                        link_info.id = res_link.id
                    }
                }
                // 处理连接删除
                else if (!isConnected && type === LiteGraph.OUTPUT) {
                    const startNode = node;
                    const endNode = application.nodeManager.nodeMap.get(link_info.target_id)
                    if (endNode instanceof KnowledgeGraphNode) {
                        application.nodeManager.handleConnectionsChange(
                            startNode,
                            type,
                            slot,
                            isConnected,
                            {
                                origin_id: startNode.id,
                                origin_slot: link_info.origin_slot,
                                target_id: endNode.id,
                                target_slot: link_info.target_slot,
                                type: link_info.type || "",
                                id: link_info.id
                            },
                            input_info
                        );
                    }
                }
            }
        };

        // 将API客户端附加到节点
        KnowledgeGraphNode.prototype.onConfigure = () => {
            this.apiClient = this.graphManager.apiClient;
        };

        KnowledgeGraphNode.prototype.getMenuOptions = (canvas) => {
            // 添加右键菜单选项
        
            const options = [];

            // 添加Ask选项（仅在选中节点时显示）
            if (canvas.selected_nodes && Object.entries(canvas.selected_nodes).length > 0) {
                options.push({
                    content: "Ask",
                    callback: () => this.uiManager.showAskPanel()
                });
            }

            return options;
        
        };

        
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

    async loadGraphData() {
        // 加载节点数据
        await this.nodeManager.loadInitialData();
        
        // 加载关系数据并创建连接
        const relationships = await this.apiClient.getRelationships();
        for (const [idx,rel] of relationships.entries()) {
            const startNode = this.nodeManager.nodeMap.get(rel.start_node.id);
            const endNode = this.nodeManager.nodeMap.get(rel.end_node.id);
            
            if (startNode && endNode) {
                // 创建图形连接
                const link = startNode.connect(startNode.outputs.length - 1, endNode, endNode.inputs.length - 1, rel.id);
                // 添加连接标签
                if (rel.type) {
                    link._label = rel.type;
                    link._label_color = "#666";
                    link._label_bgcolor = "#eee";
                }
                // 添加连接标签
                if (rel.type) {
                    link._label = rel.type;
                    link._label_color = "#666";
                    link._label_bgcolor = "#eee";
                }
                startNode.addOutput("", "");
                        
                // 为目标节点添加新的输入端口
                endNode.addInput("", "");
                
                // 调整节点大小以适应新端口
                startNode.setSize([startNode.size[0], startNode.size[1] + 20]);
                endNode.setSize([endNode.size[0], endNode.size[1] + 20]);
                
                // 刷新节点显示
                startNode.setDirtyCanvas(true, true);
                endNode.setDirtyCanvas(true, true);
            }
        }
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

    

    

    

    handleWindowResize() {
        if (this.canvas) {
            this.canvas.canvas.width = window.innerWidth;
            this.canvas.canvas.height = window.innerHeight;
        }
    }

    async freezeGraph() {
        try {
            await this.apiClient.freezeGraph();
            console.log("Graph frozen successfully");
        } catch (error) {
            console.error("Failed to freeze graph:", error);
            alert("Failed to freeze graph. Please try again.");
        }
    }

    async resetGraph() {
        try {
            await this.apiClient.resetGraph();
            console.log("Graph reset successfully");
            
            // 重新加载图形数据
            await this.loadGraphData();
        } catch (error) {
            console.error("Failed to reset graph:", error);
            alert("Failed to reset graph. Please try again.");
        }
    }
}


class KnowledgeGraphNode extends LGraphNode {
    constructor(node) {
        super();
        this.id = node.id
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
                //手动触发属性更新
                this.nodeManager.handlePropertyChanged(this, key, value);
            }
        });
    }

    // 添加属性控件
    addPropertyWidget(key, value) {
        const widget = this.addWidget("text", key, value, (newValue) => {
            this.properties[key] = newValue;
            if (this.onPropertyChanged) {
                this.onPropertyChanged(key, newValue);
            }
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
        // 清除现有控件
        this.widgets = [];
        
        // 重新添加控件
        this.addLabelsControl();
        this.addPropertiesControl();
        this.setDirtyCanvas(true, true); // 强制刷新界面
    }
}
