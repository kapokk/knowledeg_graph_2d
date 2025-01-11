export default class GraphManager {
    constructor(apiClient, wsClient,nodeManager) {
        this.apiClient = apiClient;
        this.wsClient = wsClient;
        this.graph = null;
        this.canvas = null;
        this.nodeManager = nodeManager
    }

    async initialize() {
        this.setupAskMenu();
        // Initialize graph and canvas
        this.graph = new LGraph();

        const canvasElement = document.getElementById('graph-container');
        canvasElement.width = window.innerWidth;
        canvasElement.height = window.innerHeight;
        this.canvas = new LGraphCanvas("#graph-container", this.graph);
        this.graph.start();
        this.nodeManager.graph = this.graph

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
        this.setupAskMenu();

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
            application.nodeManager.handlePropertyChanged(this, property, value);
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

    setupAskMenu() {
        const canvas = this.canvas;
        const graph = this.graph;

        // 添加右键菜单选项
        canvas.getNodeMenuOptions = (node) => {
            const options = [];

            // 添加Ask选项（仅在选中节点时显示）
            if (canvas.selected_nodes && canvas.selected_nodes.length > 0) {
                options.push({
                    content: "Ask",
                    callback: () => this.showAskPanel()
                });
            }

            return options;
        };
    }

    createPanel(title, options) {
        const panel = document.createElement("div");
        panel.className = "litegraph-panel";
        panel.style.position = "absolute";
        panel.style.right = "20px";
        panel.style.bottom = "20px";
        panel.style.width = "300px";
        panel.style.padding = "15px";
        panel.style.backgroundColor = "#fff";
        panel.style.boxShadow = "0 0 10px rgba(0,0,0,0.1)";
        panel.style.borderRadius = "5px";
        panel.style.zIndex = "1000";

        const header = document.createElement("div");
        header.className = "panel-header";
        header.textContent = title;
        panel.appendChild(header);

        const content = document.createElement("div");
        content.className = "panel-content";
        panel.appendChild(content);

        const footer = document.createElement("div");
        footer.className = "panel-footer";
        panel.appendChild(footer);

        if (options.closable) {
            const closeButton = document.createElement("button");
            closeButton.textContent = "×";
            closeButton.style.position = "absolute";
            closeButton.style.right = "5px";
            closeButton.style.top = "5px";
            closeButton.style.border = "none";
            closeButton.style.background = "none";
            closeButton.style.cursor = "pointer";
            closeButton.onclick = () => {
                panel.close();
                if (options.onClose) {
                    options.onClose();
                }
            };
            header.appendChild(closeButton);
        }

        panel.addHTML = function (html) {
            content.innerHTML += html;
        };

        panel.addButton = function (text, callback) {
            const button = document.createElement("button");
            button.textContent = text;
            button.onclick = callback;
            footer.appendChild(button);
            return button;
        };

        panel.close = function () {
            panel.parentNode.removeChild(panel);
        };

        return panel;
    }

    getCanvasWindow() {
        return this.canvas.canvas.parentNode;
    }

    showAskPanel() {
        this.closePanels(); // 关闭其他面板

        const canvasWindow = this.getCanvasWindow();
        const currentObj = this;

        // 创建面板
        const panel = this.createPanel("Ask Question", {
            closable: true,
            window: canvasWindow,
            onOpen: function () {
                // 面板打开时的回调
            },
            onClose: function () {
                currentObj.ask_panel = null; // 关闭时清空引用
            }
        });

        currentObj.ask_panel = panel; // 保存面板引用
        panel.id = "ask-panel";
        panel.classList.add("ask-panel");

        // 更新面板内容
        function updatePanelContent() {
            panel.content.innerHTML = ""; // 清空内容

            // 添加问题输入框
            panel.addHTML("<h3>Ask a Question</h3>");
            const questionInput = document.createElement("textarea");
            questionInput.placeholder = "Enter your question here...";
            questionInput.style.width = "100%";
            questionInput.style.height = "100px";
            questionInput.style.marginBottom = "10px";
            panel.content.appendChild(questionInput);

            // 添加提交按钮
            const submitButton = panel.addButton("Ask", function () {
                const question = questionInput.value.trim();
                if (question) {
                    currentObj.handleAskQuestion(question, answerOutput);
                }
            });

            // 添加答案输出框
            panel.addHTML("<h3>Answer</h3>");
            const answerOutput = document.createElement("textarea");
            answerOutput.placeholder = "Answer will appear here...";
            answerOutput.style.width = "100%";
            answerOutput.style.height = "150px";
            answerOutput.readOnly = true;
            panel.content.appendChild(answerOutput);

            // 添加清除按钮
            const clearButton = panel.addButton("Clear", function () {
                questionInput.value = "";
                answerOutput.value = "";
            });
            clearButton.style.marginLeft = "10px";
        }

        // 初始化面板内容
        updatePanelContent();

        // 将面板添加到画布容器
        this.canvas.parentNode.appendChild(panel);
    }

    async handleAskQuestion(question, answerOutput) {
        try {
            // 获取选中的节点
            const selectedNodes = this.canvas.selected_nodes || [];
            const nodeIds = selectedNodes.map(node => node.id);

            if (nodeIds.length === 0) {
                answerOutput.value = "Please select at least one node.";
                return;
            }

            // 调用API提问
            const response = await this.apiClient.askQuestion(nodeIds, question);

            // 显示结果
            answerOutput.value = response.answer || "No answer available";
        } catch (error) {
            console.error("Error asking question:", error);
            answerOutput.value = "Error: " + error.message;
        }
    }

    closePanels() {
        if (this.ask_panel) {
            this.ask_panel.close();
            this.ask_panel = null;
        }
    }

    handleWindowResize() {
        if (this.canvas) {
            this.canvas.canvas.width = window.innerWidth;
            this.canvas.canvas.height = window.innerHeight;
        }
    }
}


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
        // 清除现有控件
        this.widgets = [];
        
        // 重新添加控件
        this.addLabelsControl();
        this.addPropertiesControl();
        this.setDirtyCanvas(true, true); // 强制刷新界面
    }
}
