import os
import sys
from typing import Optional

# 添加项目根目录到 Python 路径
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(current_dir)
sys.path.append(project_root)

from database.Neo4jStuff import get_graph_instance
GRAPH = get_graph_instance()

class Graph:

    def addNode():
        pass

class Link:
    @classmethod
    def from_id(cls, relationship_id):
        """通过关系ID初始化Link对象"""
        instance = cls.__new__(cls)
        instance.id = relationship_id
        instance.get()
        return instance

    @classmethod
    def from_nodes(cls, start_node_id, end_node_id, rel_type, properties):
        """通过节点ID和关系信息创建新的关系并初始化Link对象"""
        instance = cls.__new__(cls)
        result = GRAPH.add_relationship_by_nodes_id(start_node_id, end_node_id, rel_type, properties)
        if result:
            instance.id = result["rel_id"]
            instance.get()
            return instance
        raise Exception("Failed to create relationship")

    def __init__(self):
        """默认初始化方法，不应直接调用"""
        raise NotImplementedError("Please use from_id() or from_nodes() to create a Link instance")

    def get(self):
        n = GRAPH.get_relationship_by_id(self.id)
        if (n==[]):
            raise ValueError(f"Relationship ID:{self.id} not exist")
        self.type = n["type"]
        self.properties = n["properties"]
        self.start_node = Node.from_id(n["start_node_id"])
        self.end_node = Node.from_id(n["end_node_id"])

    def remove(self):
        GRAPH.remove_relationship_by_id(self.id)

    def update(self, new_properties):
        GRAPH.update_relationship_by_rel_id(self.id,  new_properties)

    def to_dict(self):
        """序列化关系对象为字典"""
        return {
            'id': self.id,
            'type': self.type,
            'properties': self.properties,
            'start_node': self.start_node.to_dict(),
            'end_node': self.end_node.to_dict()
        }
    
    def __str__(self):
        """序列化关系对象为字典"""
        return str({
            'id': self.id,
            'type': self.type,
            'properties': self.properties,
            'start_node': self.start_node.to_dict(),
            'end_node': self.end_node.to_dict()
        })

    @staticmethod
    def search(rel_type=None, limit=3):
        """搜索符合条件的关系
        Args:
            rel_type: 要搜索的关系类型，例如 'KNOWS'
            limit: 返回结果数量限制，默认为3
        Returns:
            list[Link]: 匹配的关系对象列表
        """
        results = GRAPH.search_relationships(rel_type, limit)
        return [Link.from_id(result['rel_id']) for result in results]
    
    @staticmethod
    def get_all_relationships():
        """获取数据库中的所有节点
        
        Returns:
            list[Node]: 所有节点对象列表
        """
        relationships_data = GRAPH.get_all_relationships()
        return [Link.from_id(relationship['rel_id']) for relationship in relationships_data]

pass


class Node:
    @classmethod
    def from_id(cls, node_id):
        """通过节点ID初始化Node对象"""
        instance = cls.__new__(cls)
        instance.id = node_id
        instance.get()
        return instance

    @classmethod
    def from_node(cls, labels, properties):
        """通过标签和属性创建新的节点并初始化Node对象"""
        instance = cls.__new__(cls)
        result = GRAPH.add_node(labels, properties)
        if result:
            instance.id = result.id
            instance.get()
            return instance
        raise Exception("Failed to create node")

    def __init__(self):
        """默认初始化方法，不应直接调用"""
        raise NotImplementedError("Please use from_id() or from_properties() to create a Node instance")

    def get(self):
        n = GRAPH.get_node_by_id(self.id)
        if (n==None):
            raise ValueError(f"Node ID:{self.id} not exist")
        self.labels = n["labels"]
        self.properties = n["properties"]

    def remove(self):
        GRAPH.remove_node_by_id(self.id)

    def update(self, properties, labels=None):
        """更新节点属性和标签
        Args:
            properties (dict): 要更新的属性
            labels (list, optional): 要更新的标签列表. 默认为 None 表示不更新标签
        """
        if labels is not None:
            self.labels = labels

        GRAPH.update_node_by_node_id(self.id, properties,labels)

        self.get()

    def to(self,node):
        GRAPH.find_path(self.id,node.id)

    def connect(self, node_id, rel_type="CONNECTS_TO", properties=None):
        """连接到另一个节点
        Args:
            node (Node): 目标节点
            rel_type (str, optional): 关系类型. 默认为 "CONNECTS_TO"
            properties (dict, optional): 关系属性. 默认为 None
        Returns:
            Link: 新创建的关系对象
        """
        if properties is None:
            properties = {}
        
        result = GRAPH.add_relationship_by_nodes_id(
            self.id, 
            node_id, 
            rel_type, 
            properties
        )
        if result:
            return Link.from_id(result['rel_id'])
        raise Exception("Failed to create relationship")

    def to_dict(self):
        """序列化节点对象为字典"""
        return {
            'id': self.id,
            'labels': self.labels,
            'properties': self.properties
        }
    
    def __str__(self):
        """序列化节点对象为字典"""
        return str({
            'id': self.id,
            'labels': self.labels,
            'properties': self.properties
        })

    def get_nearby_nodes(self, max_depth=2):
        """获取当前节点附近的所有节点
        Args:
            max_depth (int): 最大搜索深度
        Returns:
            list[Node]: 附近节点列表
        """
        nodes_data = GRAPH.find_nodes_by_id_and_length(self.id, max_depth)
        return [Node.from_id(node['node_id']) for node in nodes_data]

    @staticmethod
    def get_random_nodes(count=5):
        """获取随机节点
        Args:
            count (int): 需要获取的随机节点数量
        Returns:
            list[Node]: 随机节点列表
        """
        nodes_data = GRAPH.get_random_nodes(count)
        return [Node.from_id(node['node_id']) for node in nodes_data]

    def get_random_nearby_nodes(self, count=3, max_depth=2):
        """获取当前节点附近的随机节点
        Args:
            count (int): 需要获取的随机节点数量
            max_depth (int): 最大搜索深度
        Returns:
            list[Node]: 随机附近节点列表
        """
        nearby_nodes = GRAPH.get_random_nearby_nodes(self.id, count, max_depth)
        return [Node.from_id(node['node_id']) for node in nearby_nodes]

    @staticmethod
    def search(name=None, limit=3):
        """搜索符合条件的节点
        Args:
            name: 模糊搜索的名字
            limit: 返回结果数量限制，默认为3
        Returns:
            list[Node]: 匹配的节点对象列表
        """
        results = GRAPH.search_nodes(name, limit)
        return [Node.from_id(result['node_id']) for result in results]

    @staticmethod
    def get_isolated_nodes():
        """获取数据库中的所有孤立节点（没有任何关系连接的节点）
        
        Returns:
            list[Node]: 孤立节点对象列表
        """
        nodes_data = GRAPH.get_isolated_nodes()
        return [Node.from_id(node['node_id']) for node in nodes_data]

    @staticmethod
    def get_all_nodes():
        """获取数据库中的所有节点
        
        Returns:
            list[Node]: 所有节点对象列表
        """
        nodes_data = GRAPH.get_all_nodes()
        return [Node.from_id(node['node_id']) for node in nodes_data]

    

pass

if __name__ == "__main__":
    # 搜索标签包含 'Person' 的节点
    a = Node.from_node("Node",{"name":"1"})
    b = Node.from_node("Node",{"name":"2"})
    a.connect(b.id)
    pass
