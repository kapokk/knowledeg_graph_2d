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
    
    askQuestion(nodeIds, question, onData, onComplete, onError) {
        const eventSource = new EventSource(`${this.baseUrl}/ask?nodeIds=${nodeIds.join(',')}&question=${encodeURIComponent(question)}`);
        
        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.data.partial) {
                    // 处理部分响应
                    onData && onData(data.data.partial);
                } else {
                    // 处理最终响应
                    onComplete && onComplete({
                        answer: data.data.answer,
                        nodes: data.data.nodes || []
                    });
                    eventSource.close();
                }
            } catch (error) {
                onError && onError(error);
                eventSource.close();
            }
        };

        eventSource.onerror = (error) => {
            onError && onError(error);
            eventSource.close();
        };

        return {
            close: () => eventSource.close()
        };
    }
        
}
