import GraphManager from './core/GraphManager.js';
import NodeManager from './core/NodeManager.js';
import ApiClient from './api/ApiClient.js';
import WebSocketClient from './api/WebSocketClient.js';







class Application {
    constructor() {
        // 初始化 API 客户端
        this.apiClient = new ApiClient();
        
        // 初始化 WebSocket 客户端
        //this.wsClient = new WebSocketClient();

        // 初始化节点管理器
        this.nodeManager = new NodeManager(this, this.apiClient, this.wsClient, this.graph);
        
        // 初始化图管理器
        this.graphManager = new GraphManager(this.apiClient, this.wsClient,this.nodeManager);
        
        
        

        
        
        
    }

    

    

    

    

    
    
    
    
}




// Removed createKnowledgeGraphNode since NodeManager handles this now


// 启动应用
document.addEventListener('DOMContentLoaded', () => {
    const app = new Application();
    window.app = app;
    //app.initialize();
});
