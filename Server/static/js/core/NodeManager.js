export default class NodeManager {
    constructor(apiClient, wsClient) {
        this.apiClient = apiClient;
        this.wsClient = wsClient;
        this.nodeMap = new Map();
        this.graph = null;
    }

    setGraph(graph) {
        this.graph = graph;
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
        node.pos = [Math.random() * 500, Math.random() * 500];
        node.id = nodeData.id;
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
                target_slot
            })
                .then(relationship => {
                    // 将关系ID存储在link_info中
                    link_info.relationshipId = relationship.id;
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
