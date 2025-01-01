from ..database.Neo4jDataProcessor import Node

class NodeService:
    def get_all_nodes(self):
        return Node.get_all_nodes()

    def create_node(self, labels, properties):
        return Node.from_node(labels, properties)

    def update_node(self, node_id, properties):
        node = Node.from_id(node_id)
        node.update(properties)
        return node.to_dict()

    def delete_node(self, node_id):
        node = Node.from_id(node_id)
        node.remove()
        return node.to_dict()
