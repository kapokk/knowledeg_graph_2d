export default class WebSocketClient {
    constructor(url = 'http://localhost:5000') {
        this.url = url;
        this.socket = null;
        this.connected = false;
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
        // Load Socket.IO client library dynamically
        const script = document.createElement('script');
        script.src = 'https://cdn.socket.io/4.5.4/socket.io.min.js';
        script.onload = () => {
            this.socket = io(this.url, {
                transports: ['websocket'],
                reconnection: true,
                reconnectionDelay: 5000,
                reconnectionAttempts: Infinity
            });

            this.socket.on('connect', () => {
                console.log('Socket.IO connection established');
                this.connected = true;
            });

            this.socket.on('disconnect', () => {
                console.log('Socket.IO connection closed');
                this.connected = false;
            });

            this.socket.on('connect_error', (error) => {
                console.error('Socket.IO connection error:', error);
            });

            this.socket.onAny((event, data) => {
                this.handleMessage({event, data});
            });
        };
        document.head.appendChild(script);
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
