export default class ApiClient {
    constructor(baseUrl = '/api') {
        this.baseUrl = baseUrl;
    }

    async getNodes() {
        const response = await fetch(`${this.baseUrl}/nodes`);
        const result = await response.json();
        if (result.code === 200) {
            return result.data;
        }
        throw new Error('Failed to get nodes');
    }

    async getRelationships() {
        const response = await fetch(`${this.baseUrl}/relationships`);
        const result = await response.json();
        if (result.code === 200) {
            return result.data;
        }
        throw new Error('Failed to get relationships');
    }

    async createNode(labels, properties) {
        const response = await fetch(`${this.baseUrl}/nodes`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ labels, properties })
        });
        const result = await response.json();
        if (result.code === 201) {
            return result.data;
        }
        throw new Error('Failed to create node');
    }

    async updateNode(nodeId, properties) {
        const response = await fetch(`${this.baseUrl}/nodes/${nodeId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ properties })
        });
        const result = await response.json();
        if (result.code === 200) {
            return result.data;
        }
        throw new Error('Failed to update node');
    }

    async deleteNode(nodeId) {
        const response = await fetch(`${this.baseUrl}/nodes/${nodeId}`, {
            method: 'DELETE'
        });
        const result = await response.json();
        if (result.code === 204) {
            return result.data;
        }
        throw new Error('Failed to delete node');
    }

    async createRelationship(startNodeId, endNodeId, type, properties) {
        const response = await fetch(`${this.baseUrl}/relationships`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ startNodeId, endNodeId, type, properties })
        });
        const result = await response.json();
        if (result.code === 201) {
            return result.data;
        }
        throw new Error('Failed to create relationship');
    }

    async deleteRelationship(relationshipId) {
        const response = await fetch(`${this.baseUrl}/relationships/${relationshipId}`, {
            method: 'DELETE'
        });
        const result = await response.json();
        if (result.code === 204) {
            return result.data;
        }
        throw new Error('Failed to delete relationship');
    }
    
    async askQuestion(nodeIds, question) {
        try {
            const response = await fetch(`${this.baseUrl}/ask`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ 
                    nodeIds: Array.isArray(nodeIds) ? nodeIds : [nodeIds],
                    question 
                }),
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.code === 200) {
                return {
                    answer: result.data.answer,
                    nodes: result.data.nodes || []
                };
            }
            
            throw new Error(result.message || "Failed to get answer");
            
        } catch (error) {
            console.error('Error asking question:', error);
            throw error;
        }
    }
        
}
