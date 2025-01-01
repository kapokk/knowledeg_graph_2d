export default class ApiClient {
    constructor(baseUrl = '/api') {
        this.baseUrl = baseUrl;
    }

    async getNodes() {
        const response = await fetch(`${this.baseUrl}/nodes`);
        return await response.json();
    }

    async createNode(labels, properties) {
        const response = await fetch(`${this.baseUrl}/nodes`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ labels, properties })
        });
        return await response.json();
    }

    async updateNode(nodeId, properties) {
        const response = await fetch(`${this.baseUrl}/nodes/${nodeId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ properties })
        });
        return await response.json();
    }

    async deleteNode(nodeId) {
        const response = await fetch(`${this.baseUrl}/nodes/${nodeId}`, {
            method: 'DELETE'
        });
        return await response.json();
    }

    async createRelationship(startNodeId, endNodeId, type, properties) {
        const response = await fetch(`${this.baseUrl}/relationships`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ startNodeId, endNodeId, type, properties })
        });
        return await response.json();
    }

    async deleteRelationship(relationshipId) {
        const response = await fetch(`${this.baseUrl}/relationships/${relationshipId}`, {
            method: 'DELETE'
        });
        return await response.json();
    }
}
