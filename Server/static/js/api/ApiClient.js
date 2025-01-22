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

    async updateNode(nodeId, properties = {}, labels = []) {
        const response = await fetch(`${this.baseUrl}/nodes/${nodeId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                properties,
                labels 
            })
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

    async updateRelationship(relationshipId, properties, type) {
        const response = await fetch(`${this.baseUrl}/relationships/${relationshipId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ properties, type })
        });
        const result = await response.json();
        if (result.code === 200) {
            return result.data;
        }
        throw new Error('Failed to update relationship');
    }

    async freezeGraph() {
        const response = await fetch(`${this.baseUrl}/freeze`, {
            method: 'POST'
        });
        const result = await response.json();
        if (result.code === 200) {
            return result;
        }
        throw new Error('Failed to freeze graph');
    }

    async resetGraph() {
        const response = await fetch(`${this.baseUrl}/reset`, {
            method: 'POST'
        });
        const result = await response.json();
        if (result.code === 200) {
            return result;
        }
        throw new Error('Failed to reset graph');
    }
    
    askQuestion(nodeIds, question, onData, onComplete, onError) {
        const controller = new AbortController();
        
        fetch(`${this.baseUrl}/ask`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                nodeIds: Array.isArray(nodeIds) ? nodeIds : [nodeIds],
                question
            }),
            signal: controller.signal
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            
            function read() {
                return reader.read().then(({done, value}) => {
                    if (done) {
                        if (buffer) {
                            try {
                                const data = JSON.parse(buffer);
                                onComplete && onComplete({
                                    answer: data.data.answer,
                                    nodes: data.data.nodes || []
                                });
                            } catch (error) {
                                onError && onError(error);
                            }
                        }
                        return;
                    }
                    
                    buffer += decoder.decode(value, {stream: true});
                    
                    // 处理可能的多条消息
                    const messages = buffer.split('\n\n');
                    buffer = messages.pop(); // 最后一条可能不完整
                    
                    messages.forEach(message => {
                        try {
                            const data = JSON.parse(message.replace('data: ', ''));
                            if (data.data.partial) {
                                onData && onData(data.data.partial);
                            }
                        } catch (error) {
                            onError && onError(error);
                        }
                    });
                    
                    return read();
                });
            }
            
            return read();
        })
        .catch(error => {
            onError && onError(error);
        });

        return {
            close: () => controller.abort()
        };
    }
        
}
