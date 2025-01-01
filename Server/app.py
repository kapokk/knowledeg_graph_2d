import os
import sys

# Add the project root directory to the Python path
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.append(project_root)

from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from flask_socketio import SocketIO, emit
from database.Neo4jStuff import get_graph_instance
import threading
import time

app = Flask(__name__, static_folder='static', static_url_path='')
CORS(app)  # 允许跨域请求
GRAPH = get_graph_instance()
socketio = SocketIO(app, 
                   cors_allowed_origins="*",
                   async_mode='threading',
                   logger=True,
                   engineio_logger=True)

# WebSocket 事件监听
@socketio.on('connect')
def handle_connect():
    print('Client connected')

@socketio.on('disconnect')
def handle_disconnect():
    print('Client disconnected')

# 广播节点创建事件
def broadcast_node_created(node):
    socketio.emit('node_created', node)

# 广播节点更新事件
def broadcast_node_updated(node):
    socketio.emit('node_updated', node)

# 广播节点删除事件
def broadcast_node_deleted(node_id):
    socketio.emit('node_deleted', {'id': node_id})

# 广播关系创建事件
def broadcast_relationship_created(relationship):
    socketio.emit('relationship_created', relationship)

# 广播关系更新事件
def broadcast_relationship_updated(relationship):
    socketio.emit('relationship_updated', relationship)

# 广播关系删除事件
def broadcast_relationship_deleted(relationship_id):
    socketio.emit('relationship_deleted', {'id': relationship_id})

# 轮询 Neo4j 数据变化
def poll_neo4j_changes():
    last_nodes = set()
    last_relationships = set()

    while True:
        # 获取当前节点和关系
        current_nodes = set(node['node_id'] for node in GRAPH.get_all_nodes())
        current_relationships = set(rel['rel_id'] for rel in GRAPH.get_all_relationships())

        # 检查新增节点
        new_nodes = current_nodes - last_nodes
        for node_id in new_nodes:
            node = GRAPH.get_node_by_id(node_id)
            broadcast_node_created(node)

        # 检查删除节点
        deleted_nodes = last_nodes - current_nodes
        for node_id in deleted_nodes:
            broadcast_node_deleted(node_id)

        # 检查新增关系
        new_relationships = current_relationships - last_relationships
        for rel_id in new_relationships:
            relationship = GRAPH.get_relationship_by_id(rel_id)
            broadcast_relationship_created(relationship)

        # 检查删除关系
        deleted_relationships = last_relationships - current_relationships
        for rel_id in deleted_relationships:
            broadcast_relationship_deleted(rel_id)

        # 更新缓存
        last_nodes = current_nodes
        last_relationships = current_relationships

        # 轮询间隔
        time.sleep(5)

# 启动轮询线程
threading.Thread(target=poll_neo4j_changes, daemon=True).start()

@app.route('/')
def home():
    return render_template('index.html')

# 获取所有节点
@app.route('/api/nodes', methods=['GET'])
def get_nodes():
    nodes = GRAPH.get_all_nodes()
    return jsonify(nodes)

# 创建新节点
@app.route('/nodes', methods=['POST'])
def create_node():
    data = request.json
    labels = data.get('labels', ['Node'])
    properties = data.get('properties', {})
    node = GRAPH.add_node(labels, properties)
    return jsonify(node)

# 更新节点属性
@app.route('/nodes/<int:node_id>', methods=['PUT'])
def update_node(node_id):
    properties = request.json.get('properties', {})
    updated_node = GRAPH.update_node_by_node_id(node_id, properties)
    return jsonify(updated_node)

# 删除节点
@app.route('/nodes/<int:node_id>', methods=['DELETE'])
def delete_node(node_id):
    deleted_node = GRAPH.remove_node_by_id(node_id)
    return jsonify(deleted_node)

# 创建新关系
@app.route('/relationships', methods=['POST'])
def create_relationship():
    data = request.json
    start_node_id = data.get('startNodeId')
    end_node_id = data.get('endNodeId')
    rel_type = data.get('type', 'CONNECTS_TO')
    properties = data.get('properties', {})
    relationship = GRAPH.add_relationship_by_nodes_id(start_node_id, end_node_id, rel_type, properties)
    return jsonify(relationship)

# 更新关系属性
@app.route('/relationships/<int:relationship_id>', methods=['PUT'])
def update_relationship(relationship_id):
    properties = request.json.get('properties', {})
    updated_relationship = GRAPH.update_relationship_by_rel_id(relationship_id, properties)
    return jsonify(updated_relationship)

# 删除关系
@app.route('/relationships/<int:relationship_id>', methods=['DELETE'])
def delete_relationship(relationship_id):
    deleted_relationship = GRAPH.remove_relationship_by_id(relationship_id)
    return jsonify(deleted_relationship)

if __name__ == '__main__':
    socketio.run(app, debug=True)
from flask import Flask
from flask_cors import CORS
from flask_socketio import SocketIO
from .api.nodes import nodes_bp
from .api.relationships import relationships_bp
from .database.Neo4jStuff import get_graph_instance
import threading
import time

app = Flask(__name__, static_folder='static', static_url_path='')
CORS(app)
GRAPH = get_graph_instance()
socketio = SocketIO(app, 
                   cors_allowed_origins="*",
                   async_mode='threading',
                   logger=True,
                   engineio_logger=True)

# Register blueprints
app.register_blueprint(nodes_bp, url_prefix='/api')
app.register_blueprint(relationships_bp, url_prefix='/api')

# WebSocket events
@socketio.on('connect')
def handle_connect():
    print('Client connected')

@socketio.on('disconnect')
def handle_disconnect():
    print('Client disconnected')

# Broadcast functions
def broadcast_node_created(node):
    socketio.emit('node_created', node)

def broadcast_node_updated(node):
    socketio.emit('node_updated', node)

def broadcast_node_deleted(node_id):
    socketio.emit('node_deleted', {'id': node_id})

def broadcast_relationship_created(relationship):
    socketio.emit('relationship_created', relationship)

def broadcast_relationship_updated(relationship):
    socketio.emit('relationship_updated', relationship)

def broadcast_relationship_deleted(relationship_id):
    socketio.emit('relationship_deleted', {'id': relationship_id})

# Neo4j polling thread
def poll_neo4j_changes():
    last_nodes = set()
    last_relationships = set()

    while True:
        current_nodes = set(node['node_id'] for node in GRAPH.get_all_nodes())
        current_relationships = set(rel['rel_id'] for rel in GRAPH.get_all_relationships())

        # Check for new nodes
        new_nodes = current_nodes - last_nodes
        for node_id in new_nodes:
            node = GRAPH.get_node_by_id(node_id)
            broadcast_node_created(node)

        # Check for deleted nodes
        deleted_nodes = last_nodes - current_nodes
        for node_id in deleted_nodes:
            broadcast_node_deleted(node_id)

        # Check for new relationships
        new_relationships = current_relationships - last_relationships
        for rel_id in new_relationships:
            relationship = GRAPH.get_relationship_by_id(rel_id)
            broadcast_relationship_created(relationship)

        # Check for deleted relationships
        deleted_relationships = last_relationships - current_relationships
        for rel_id in deleted_relationships:
            broadcast_relationship_deleted(rel_id)

        # Update cache
        last_nodes = current_nodes
        last_relationships = current_relationships

        # Polling interval
        time.sleep(5)

# Start polling thread
threading.Thread(target=poll_neo4j_changes, daemon=True).start()

@app.route('/')
def home():
    return app.send_static_file('index.html')

if __name__ == '__main__':
    socketio.run(app, debug=True)
