class NodeManager {
    constructor(apiClient) {
        this.apiClient = apiClient;
        this.nodeMap = new Map();
    }

    async loadNodes() {
        try {
            const nodes = await this.apiClient.getNodes();
            nodes.forEach(node => {
                const lgNode = this.createNode(node);
                this.nodeMap.set(node.id, lgNode);
                return lgNode;
            });
        } catch (error) {
            console.error('Failed to load nodes:', error);
        }
    }

    createNode(nodeData) {
        const node = LiteGraph.createNode("knowledge/KnowledgeGraphNode", nodeData);
        node.title = nodeData.labels.join(', ');
        node.pos = [Math.random() * 500, Math.random() * 500];
        return node;
    }

    async createNodeInBackend(labels, properties) {
        return await this.apiClient.createNode(labels, properties);
    }

    async updateNode(nodeId, properties) {
        return await this.apiClient.updateNode(nodeId, properties);
    }

    async deleteNode(nodeId) {
        return await this.apiClient.deleteNode(nodeId);
    }

    getNodeById(nodeId) {
        return this.nodeMap.get(nodeId);
    }

    removeNodeFromMap(nodeId) {
        this.nodeMap.delete(nodeId);
    }
}

export default NodeManager;
