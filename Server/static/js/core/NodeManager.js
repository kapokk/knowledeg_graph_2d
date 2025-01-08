export default class NodeManager {
    constructor(apiClient, wsClient, graph) {
        this.apiClient = apiClient;
        this.wsClient = wsClient;
        this.graph = graph;
        this.nodeMap = new Map();
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
                        Math.random() * this.graph.canvas.canvas.width,
                        Math.random() * this.graph.canvas.canvas.height
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

        const properties = { ...node.properties, [property]: value };
        this.apiClient.updateNode(node.id, properties)
            .then(updatedNode => {
                node.properties = updatedNode.properties;
                node.refreshControls()
            })
            .catch(error => {
                console.error('Failed to update node:', error);
                node.properties[property] = node.properties[property];
                node.refreshControls()
            });
    }

    handleConnectionsChange(node, type, slot, isConnected, link_info, input_info) {
        const { origin_id, origin_slot, target_id, target_slot, type: link_type } = link_info;
        
        if (!origin_id || !target_id) {
            return;
        }

        if (isConnected && type === LiteGraph.OUTPUT) {
            // 创建新连接
            this.apiClient.createRelationship(origin_id, target_id, link_type || 'CONNECTS_TO', {
                origin_slot,
                target_slot,
                label: link_type || 'CONNECTS_TO'  // 添加标签
            })
                .then(relationship => {
                    // 将关系ID存储在link_info中
                    link_info.relationshipId = relationship.id;

                    // 获取源节点和目标节点
                    const sourceNode = this.nodeMap.get(origin_id);
                    const targetNode = this.nodeMap.get(target_id);

                    if (sourceNode && targetNode) {
                        // 为源节点添加新的输出端口
                        sourceNode.addOutput("", "");
                        
                        // 为目标节点添加新的输入端口
                        targetNode.addInput("", "");
                        
                        // 调整节点大小以适应新端口
                        sourceNode.setSize([sourceNode.size[0], sourceNode.size[1] + 20]);
                        targetNode.setSize([targetNode.size[0], targetNode.size[1] + 20]);
                        
                        // 刷新节点显示
                        sourceNode.setDirtyCanvas(true, true);
                        targetNode.setDirtyCanvas(true, true);
                    }
                })
                .catch(console.error);
        } else if (!isConnected && type === LiteGraph.OUTPUT) {
            // 删除连接
            if (link_info.relationshipId) {
                this.apiClient.deleteRelationship(link_info.relationshipId)
                    .catch(console.error);
            } else {
                console.warn('No relationship ID found for connection removal');
            }
        }
    }
}
