import os
import sys

# Add the project root directory to the Python path
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.append(project_root)

from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from flask_socketio import SocketIO, emit
from database.Neo4jDataProcessor import Node, Link
import threading
import time

app = Flask(__name__, static_folder='static', static_url_path='')
CORS(app)  # 允许跨域请求
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
        current_nodes = set(node.id for node in Node.get_all_nodes())
        current_relationships = set(link.id for link in Link.get_all_relationships())

        # 检查新增节点
        new_nodes = current_nodes - last_nodes
        for node_id in new_nodes:
            node = Node.from_id(node_id).to_dict()
            broadcast_node_created(node)

        # 检查删除节点
        deleted_nodes = last_nodes - current_nodes
        for node_id in deleted_nodes:
            broadcast_node_deleted(node_id)

        # 检查新增关系
        new_relationships = current_relationships - last_relationships
        for rel_id in new_relationships:
            relationship = Link.from_id(rel_id).to_dict()
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

# 节点接口
@app.route('/api/nodes', methods=['GET', 'POST'])
def handle_nodes():
    if request.method == 'GET':
        nodes = [node.to_dict() for node in Node.get_all_nodes()]
        return jsonify({
            'code': 200,
            'data': nodes
        })
    elif request.method == 'POST':
        data = request.json
        properties = data.get('properties', {})
        node = Node.from_node("Node", properties)
        return jsonify({
            'code': 201,
            'data': node.to_dict()
        })

@app.route('/api/nodes/<int:node_id>', methods=['GET', 'PUT', 'DELETE'])
def handle_node(node_id):
    if request.method == 'GET':
        node = Node.from_id(node_id).to_dict()
        return jsonify({
            'code': 200,
            'data': node
        })
    elif request.method == 'PUT':
        properties = request.json.get('properties', {})
        node = Node.from_id(node_id)
        node.update(properties)
        updated_node = node.to_dict()
        return jsonify({
            'code': 200,
            'data': updated_node
        })
    elif request.method == 'DELETE':
        node = Node.from_id(node_id)
        node.remove()
        deleted_node = node.to_dict()
        return jsonify({
            'code': 204,
            'data': deleted_node
        })

# 关系接口
@app.route('/api/relationships', methods=['GET', 'POST'])
def handle_relationships():
    if request.method == 'GET':
        relationships = [link.to_dict() for link in Link.get_all_relationships()]
        return jsonify({
            'code': 200,
            'data': relationships
        })
    elif request.method == 'POST':
        data = request.json
        start_node_id = data.get('startNodeId')
        end_node_id = data.get('endNodeId')
        rel_type = data.get('type', 'CONNECTS_TO')
        properties = data.get('properties', {})
        start_node = Node.from_id(start_node_id)
        relationship = start_node.connect(end_node_id, rel_type, properties).to_dict()
        return jsonify({
            'code': 201,
            'data': relationship
        })

@app.route('/api/ask', methods=['POST'])
def handle_ask():
    data = request.json
    node_ids = data.get('nodeIds', [])
    question = data.get('question', '')

    if not node_ids or not question:
        return jsonify({
            'code': 400,
            'message': 'Both nodeIds and question are required'
        }), 400

    try:
        # Get node information
        nodes = []
        for node_id in node_ids:
            node = Node.from_id(node_id)
            if node:
                nodes.append(node.to_dict())

        # Here you would call your AI/LLM service to get the answer
        # For now we'll just return a placeholder response
        answer = f"Answer to question '{question}' about nodes {node_ids}"

        return jsonify({
            'code': 200,
            'data': {
                'answer': answer,
                'nodes': nodes
            }
        })
    except Exception as e:
        return jsonify({
            'code': 500,
            'message': str(e)
        }), 500

@app.route('/api/relationships/<int:relationship_id>', methods=['GET', 'PUT', 'DELETE'])
def handle_relationship(relationship_id):
    if request.method == 'GET':
        relationship = Link.from_id(relationship_id).to_dict()
        return jsonify({
            'code': 200,
            'data': relationship
        })
    elif request.method == 'PUT':
        properties = request.json.get('properties', {})
        relationship = Link.from_id(relationship_id)
        relationship.update(properties)
        updated_relationship = relationship.to_dict()
        return jsonify({
            'code': 200,
            'data': updated_relationship
        })
    elif request.method == 'DELETE':
        relationship = Link.from_id(relationship_id)
        relationship.remove()
        deleted_relationship = relationship.to_dict()
        return jsonify({
            'code': 204,
            'data': deleted_relationship
        })

if __name__ == '__main__':
    socketio.run(app, debug=True,allow_unsafe_werkzeug=True)

