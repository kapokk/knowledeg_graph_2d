class WebSocketClient {
    constructor(url = 'ws://localhost:5000/socket.io') {
        this.url = url;
        this.socket = null;
        this.callbacks = {
            onNodeUpdate: [],
            onNodeCreate: [],
            onNodeDelete: [],
            onRelationshipUpdate: [],
            onRelationshipCreate: [],
            onRelationshipDelete: []
        };
    }

    connect() {
        this.socket = new WebSocket(this.url);

        this.socket.onmessage = (event) => {
            const message = JSON.parse(event.data);
            this.handleMessage(message);
        };

        this.socket.onopen = () => {
            console.log('WebSocket connection established');
        };

        this.socket.onclose = () => {
            console.log('WebSocket connection closed');
            // Attempt to reconnect after 5 seconds
            setTimeout(() => this.connect(), 5000);
        };

        this.socket.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
    }

    handleMessage(message) {
        const { event, data } = message;
        switch (event) {
            case 'node_created':
                this.callbacks.onNodeCreate.forEach(cb => cb(data));
                break;
            case 'node_updated':
                this.callbacks.onNodeUpdate.forEach(cb => cb(data));
                break;
            case 'node_deleted':
                this.callbacks.onNodeDelete.forEach(cb => cb(data));
                break;
            case 'relationship_created':
                this.callbacks.onRelationshipCreate.forEach(cb => cb(data));
                break;
            case 'relationship_updated':
                this.callbacks.onRelationshipUpdate.forEach(cb => cb(data));
                break;
            case 'relationship_deleted':
                this.callbacks.onRelationshipDelete.forEach(cb => cb(data));
                break;
            default:
                console.warn('Unknown WebSocket event:', event);
        }
    }

    on(event, callback) {
        if (this.callbacks[event]) {
            this.callbacks[event].push(callback);
        } else {
            console.warn(`Unknown event type: ${event}`);
        }
    }
}
