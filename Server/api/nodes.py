from flask import Blueprint, request, jsonify
from ..services.node_service import NodeService

nodes_bp = Blueprint('nodes', __name__)
node_service = NodeService()

@nodes_bp.route('/nodes', methods=['GET'])
def get_nodes():
    nodes = node_service.get_all_nodes()
    return jsonify(nodes)

@nodes_bp.route('/nodes', methods=['POST'])
def create_node():
    data = request.json
    labels = data.get('labels', ['Node'])
    properties = data.get('properties', {})
    node = node_service.create_node(labels, properties)
    return jsonify(node)

@nodes_bp.route('/nodes/<int:node_id>', methods=['PUT'])
def update_node(node_id):
    properties = request.json.get('properties', {})
    updated_node = node_service.update_node(node_id, properties)
    return jsonify(updated_node)

@nodes_bp.route('/nodes/<int:node_id>', methods=['DELETE'])
def delete_node(node_id):
    deleted_node = node_service.delete_node(node_id)
    return jsonify(deleted_node)
