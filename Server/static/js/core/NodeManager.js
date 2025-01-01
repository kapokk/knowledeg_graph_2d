export default class NodeManager {
    constructor(apiClient, wsClient) {
        this.apiClient = apiClient;
        this.wsClient = wsClient;
        this.nodeMap = new Map();
    }

    async loadInitialData() {
        try {
            const nodes = await this.apiClient.getNodes();
            nodes.forEach(node => {
                const lgNode = this.createKnowledgeGraphNode(node);
                this.nodeMap.set(node.id, lgNode);
            });
        } catch (error) {
            console.error('Failed to load initial data:', error);
        }
    }

    createKnowledgeGraphNode(nodeData) {
        const node = LiteGraph.createNode("knowledge/KnowledgeGraphNode", nodeData);
        node.title = nodeData.labels.join(', ');
        node.pos = [Math.random() * 500, Math.random() * 500];
        return node;
    }

    handleNodeCreated(nodeData) {
        const lgNode = this.createKnowledgeGraphNode(nodeData);
        this.nodeMap.set(nodeData.id, lgNode);
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
        if (lgNode) {
            this.nodeMap.delete(nodeData.id);
        }
    }
}
