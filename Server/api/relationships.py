from flask import Blueprint, request, jsonify
from ..services.relationship_service import RelationshipService

relationships_bp = Blueprint('relationships', __name__)
relationship_service = RelationshipService()

@relationships_bp.route('/relationships', methods=['POST'])
def create_relationship():
    data = request.json
    start_node_id = data.get('startNodeId')
    end_node_id = data.get('endNodeId')
    rel_type = data.get('type', 'CONNECTS_TO')
    properties = data.get('properties', {})
    relationship = relationship_service.create_relationship(start_node_id, end_node_id, rel_type, properties)
    return jsonify(relationship)

@relationships_bp.route('/relationships/<int:relationship_id>', methods=['PUT'])
def update_relationship(relationship_id):
    properties = request.json.get('properties', {})
    updated_relationship = relationship_service.update_relationship(relationship_id, properties)
    return jsonify(updated_relationship)

@relationships_bp.route('/relationships/<int:relationship_id>', methods=['DELETE'])
def delete_relationship(relationship_id):
    deleted_relationship = relationship_service.delete_relationship(relationship_id)
    return jsonify(deleted_relationship)
