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
                
            })
            .catch(error => {
                console.error('Failed to create node:', error);
                alert('Failed to create node. Please try again.');
            });
    }

    handleNodeRemoved(node) {
        const nodeId = [...this.nodeMap.entries()].find(([id, n]) => n === node)?.[0];
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
                node.setDirtyCanvas(true, true);
            })
            .catch(error => {
                console.error('Failed to update node:', error);
                node.properties[property] = node.properties[property];
                node.setDirtyCanvas(true, true);
            });
    }

    handleConnectionsChange(node, type, slot, connected, link_info, input_info) {
        if (connected && type === LiteGraph.OUTPUT) {
            const startNodeId = node.id;
            const endNodeId = link_info.target.node.id;
            if (startNodeId && endNodeId) {
                this.apiClient.createRelationship(startNodeId, endNodeId, 'CONNECTS_TO', {})
                    .catch(console.error);
            }
        }
    }
}
