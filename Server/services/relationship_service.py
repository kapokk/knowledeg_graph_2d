from ..database.Neo4jDataProcessor import Link

class RelationshipService:
    def create_relationship(self, start_node_id, end_node_id, rel_type, properties):
        return Link.from_nodes(start_node_id, end_node_id, rel_type, properties)

    def update_relationship(self, relationship_id, properties):
        relationship = Link.from_id(relationship_id)
        relationship.update(properties)
        return relationship.to_dict()

    def delete_relationship(self, relationship_id):
        relationship = Link.from_id(relationship_id)
        relationship.remove()
        return relationship.to_dict()
