export default class NodeManager {
    constructor(app,apiClient, wsClient, graph) {
        this.apiClient = apiClient;
        this.wsClient = wsClient;
        this.graph = graph;
        this.nodeMap = new Map();
        this.app = app;
    }

    async loadInitialData() {
        try {
            const nodes = await this.apiClient.getNodes();
            nodes.forEach(node => {
                const lgNode = this.createKnowledgeGraphNode(node);
                this.nodeMap.set(node.id, lgNode);
                if (this.graph) {
                    this.graph.add(lgNode);
                }
            });
        } catch (error) {
            console.error('Failed to load initial data:', error);
        }
    }

    createKnowledgeGraphNode(nodeData) {
        const node = LiteGraph.createNode("knowledge/KnowledgeGraphNode", nodeData);
        node.title = nodeData.labels.join(', ');
        node.id = nodeData.id;

        // 为每个属性控件添加变化监听
        
        node.widgets.forEach(widget => {
            
            widget.callback = (value) => {
                if (widget.name == "Labels") { 
                    node.labels = value.split(",").map(label => label.trim());
                    this.handlePropertyChanged(node, widget.name, value);
                }
                else{
                    node.properties[widget.name] = value;
                    this.handlePropertyChanged(node, widget.name, value);
                }
            };
            
        });
        
        
        // 计算不重叠的位置
        const padding = 50; // 节点之间的最小间距
        let pos = [Math.random() * 500, Math.random() * 500];
        let collision = true;
        let attempts = 0;
        
        // 最多尝试100次找到不重叠的位置
        while (collision && attempts < 100) {
            collision = false;
            
            // 检查与所有现有节点的碰撞
            for (const existingNode of this.nodeMap.values()) {
                const dx = Math.abs(pos[0] - existingNode.pos[0]);
                const dy = Math.abs(pos[1] - existingNode.pos[1]);
                const minDistance = padding + Math.max(
                    node.size[0]/2 + existingNode.size[0]/2,
                    node.size[1]/2 + existingNode.size[1]/2
                );
                
                if (dx < minDistance && dy < minDistance) {
                    // 发生碰撞，生成新位置
                    pos = [
                        Math.random() * this.graph.list_of_graphcanvas[0].canvas.clientWidth,
                        Math.random() * this.graph.list_of_graphcanvas[0].canvas.clientHeight
                    ];
                    collision = true;
                    attempts++;
                    break;
                }
            }
        }
        
        node.pos = pos;
        return node;
    }

    handleNodeCreated(nodeData) {
        const lgNode = this.createKnowledgeGraphNode(nodeData);
        this.nodeMap.set(nodeData.id, lgNode);
        if (this.graph) {
            this.graph.add(lgNode);
        }
    }

    handleNodeUpdated(nodeData) {
        const lgNode = this.nodeMap.get(nodeData.id);
        if (lgNode) {
            lgNode.properties = nodeData.properties;
            lgNode.title = nodeData.labels.join(', ');
            lgNode.setDirtyCanvas(true, true);
        }
    }

    handleNodeDeleted(nodeData) {
        const lgNode = this.nodeMap.get(nodeData.id);
        if (lgNode && this.graph) {
            this.graph.remove(lgNode);
            this.nodeMap.delete(nodeData.id);
        }
    }

    handleNodeAdded(node) {
        console.log("node added")
        this.apiClient.createNode(node.labels, node.properties)
            .then(createdNode => {
                node.id = createdNode.id;
                node.properties = createdNode.properties;
                node.labels = createdNode.labels;
                node.title = createdNode.labels.join(', ');
                this.nodeMap.set(createdNode.id, node);
                node.refreshControls()
            })
            .catch(error => {
                console.error('Failed to create node:', error);
                alert('Failed to create node. Please try again.');
            });
    }

    handleNodeRemoved(node) {
        const nodeId = node.id
        if (nodeId) {
            this.apiClient.deleteNode(nodeId)
                .catch(console.error);
        }
    }

    handlePropertyChanged(node, property, value) {
        if (!node.id) {
            console.error('Node ID not found');
            return;
        }

        if (property === "Labels") {
            // Handle label update
            const labels = value.split(",").map(label => label.trim());
            this.apiClient.updateNode(node.id, {}, labels)
                .then(updatedNode => {
                    node.labels = labels;
                    node.title = labels.join(', ');
                    node.refreshControls();
                })
                .catch(error => {
                    console.error('Failed to update labels:', error);
                    node.refreshControls();
                });
        } else {
            // Handle property update
            const properties = { ...node.properties, [property]: value };
            this.apiClient.updateNode(node.id, properties)
                .then(updatedNode => {
                    node.properties = updatedNode.properties;
                    node.refreshControls();
                })
                .catch(error => {
                    console.error('Failed to update node:', error);
                    node.properties[property] = node.properties[property]; // Revert change
                    node.refreshControls();
                });
        }
    }

    async handleConnectionsChange(node, type, slot, isConnected, link_info, input_info) {
        const { origin_id, origin_slot, target_id, target_slot, type: link_type } = link_info;
        
        if (!origin_id || !target_id) {
            return;
        }

        if (isConnected && type === LiteGraph.OUTPUT) {
            // 创建新连接
            const res_link = await this.apiClient.createRelationship(origin_id, target_id, link_type || 'CONNECTS_TO', {
                origin_slot,
                target_slot,
                label: link_type || 'CONNECTS_TO'  // 添加标签
            })
                .then(relationship => {
                    // 将关系ID存储在link_info中
                    link_info.id = relationship.id;
                    return link_info
                })
                .catch(console.error);
            return res_link
        } else if (!isConnected && type === LiteGraph.OUTPUT) {
            // 删除连接
            if (link_info.id) {
                this.apiClient.deleteRelationship(link_info.id)
                    .catch(console.error);
            } else {
                console.warn('No relationship ID found for connection removal');
            }
        }
    }
}
