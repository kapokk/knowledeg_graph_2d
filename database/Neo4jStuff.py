import warnings

# 忽略与 Neo4j 相关的废弃警告
warnings.filterwarnings("ignore", message=".*deprecated.*")

from neo4j import GraphDatabase

# 添加常量定义在文件开头
NODE_INDEX_NAME = "test"
RELATIONSHIP_INDEX_NAME = "test_rel"

class Neo4jGraph:
    def __init__(self, uri, user, password):
        self.driver = GraphDatabase.driver(uri, auth=(user, password))
        self.session = None

    def close(self):
        if self.session:
            self.session.close()
        if self.driver:
            self.driver.close()

    def begin_session(self):
        self.session = self.driver.session()
        return self.session

    def end_session(self):
        if self.session:
            self.session.close()
            self.session = None

    def add_node(self, node_name, properties):
        with self.begin_session() as session:
            result = session.execute_write(self._add_node, node_name=node_name, **properties)
            return result
    def _add_node(self, tx, node_name, **properties):
        # 创建一个包含所有属性的字符串，格式为 "key1: $key1, key2: $key2, ..."
        if properties:
            properties_query = ", " + ", ".join([f"{key}: ${key}" for key in properties])
        else:
            properties_query = ""
        query = f"CREATE (n:Node {{name: $node_name{properties_query}}}) RETURN n"
        result = tx.run(query, node_name=node_name, **properties)
        return result.single()[0] if result.peek() else None

    # 删除节点并返回影响的节点
    def remove_node(self, node_name):
        with self.begin_session() as session:
            result = session.write_transaction(self._remove_node, node_name)
            return result

    def _remove_node(self, tx, node_name):
        query = f"MATCH (n:Node {{name: $node_name}}) DETACH DELETE n RETURN n"
        result = tx.run(query, node_name=node_name)
        return result.single()[0] if result.peek() else None

    def remove_node_by_id(self, node_id):
        with self.begin_session() as session:
            result = session.write_transaction(self._remove_node_by_id, node_id)
            return result

    def _remove_node_by_id(self, tx, node_id):
        query = """
        MATCH (n:Node)
        WHERE id(n) = $node_id
        DETACH DELETE n
        RETURN n
        """
        result = tx.run(query, node_id=node_id)
        return result.single()[0] if result.peek() else None

    # 更新节点并返回更新后的节点
    def update_node_by_node_id(self, node_id, new_properties, new_labels=None):
        with self.begin_session() as session:
            result = session.write_transaction(self._update_node_by_node_id, node_id, new_properties, new_labels)
            return result

    def _update_node_by_node_id(self, tx, node_id, new_properties, new_labels=None):
        # Handle different update scenarios
        if new_labels is not None and new_properties:
            # Update both properties and labels
            query = """
            MATCH (n)
            WHERE id(n) = $node_id
            SET n += $new_properties
            WITH n
            CALL apoc.create.setLabels(n, $new_labels) YIELD node
            RETURN node
            """
            result = tx.run(query, node_id=node_id, new_properties=new_properties, new_labels=new_labels)
        elif new_labels is not None:
            # Only update labels
            query = """
            MATCH (n)
            WHERE id(n) = $node_id
            CALL apoc.create.setLabels(n, $new_labels) YIELD node
            RETURN node
            """
            result = tx.run(query, node_id=node_id, new_labels=new_labels)
        elif new_properties:
            # Only update properties
            query = """
            MATCH (n)
            WHERE id(n) = $node_id
            SET n += $new_properties
            RETURN n
            """
            result = tx.run(query, node_id=node_id, new_properties=new_properties)
        else:
            # No updates to perform
            query = """
            MATCH (n)
            WHERE id(n) = $node_id
            RETURN n
            """
            result = tx.run(query, node_id=node_id)
            
        return result.single()[0] if result.peek() else None

    def find_path(self, start_node_name, end_node_name):
        with self.begin_session() as session:
            result = session.execute_read(self._find_path, start_node_name, end_node_name)
            return result

    def _find_path(self, tx, start_node_name, end_node_name):
        query = """
        MATCH path = (a:Node {name: $start_node_name})-[*]->(b:Node {name: $end_node_name})
        RETURN path
        """
        result = tx.run(query, start_node_name=start_node_name, end_node_name=end_node_name)
        return [record["path"] for record in result]

    # 添加关系并返回新关系
    def add_relationship(self, start_node_name, end_node_name, relationship_type, properties):
        with self.begin_session() as session:
            result = session.write_transaction(self._add_relationship, start_node_name, end_node_name,
                                               relationship_type, properties)
            return result

    def _add_relationship(self, tx, start_node_name, end_node_name, relationship_type, properties):
        query = f"""
        MATCH (a:Node {{name: $start_node_name}}), (b:Node {{name: $end_node_name}})
        CREATE (a)-[r:{relationship_type} $properties]->(b)
        RETURN r
        """
        result = tx.run(query, start_node_name=start_node_name, end_node_name=end_node_name, properties=properties)
        return result.single()[0] if result.peek() else None

    # 删除关系并返回影响的关系
    def remove_relationship(self, start_node_name, end_node_name, relationship_type):
        with self.begin_session() as session:
            result = session.write_transaction(self._remove_relationship, start_node_name, end_node_name,
                                               relationship_type)
            return result

    def _remove_relationship(self, tx, start_node_name, end_node_name, relationship_type):
        query = f"""
        MATCH (a:Node {{name: $start_node_name}})-[r:{relationship_type}]->(b:Node {{name: $end_node_name}})
        DELETE r
        RETURN r
        """
        result = tx.run(query, start_node_name=start_node_name, end_node_name=end_node_name)
        return result.single()[0] if result.peek() else None

    def remove_relationship_by_id(self, relationship_id):
        with self.begin_session() as session:
            result = session.write_transaction(self._remove_relationship_by_id, relationship_id)
            return result

    def _remove_relationship_by_id(self, tx, relationship_id):
        query = """
        MATCH (a)-[r]->(b)
        WHERE id(r) = $relationship_id
        DELETE r
        RETURN r
        """
        result = tx.run(query, relationship_id=relationship_id)
        return result.single()[0] if result.peek() else None

   

    # 更新关系并返回更新后的关系
    def update_relationship_by_rel_id(self, rel_id, new_properties):
        with self.begin_session() as session:
            result = session.write_transaction(self._update_relationship_by_rel_id, rel_id, new_properties)
            return result

    def _update_relationship_by_rel_id(self, tx, rel_id, new_properties):
        query = """
        MATCH ()-[r]->()
        WHERE id(r) = $rel_id
        SET r += $new_properties
        RETURN r
        """
        result = tx.run(query, rel_id=rel_id, new_properties=new_properties)
        return result.single()[0] if result.peek() else None

    def get_all_nodes(self):
        """获取数据库中的所有节点
        
        Returns:
            list: 所有节点的列表，每个节点包含 node_id, labels 和 properties
        """
        with self.begin_session() as session:
            return session.execute_read(self._get_all_nodes)

    def _get_all_nodes(self, tx):
        query = """
        MATCH (n:Node)
        RETURN id(n) as node_id, labels(n) as node_labels, 
               keys(n) as node_keys, [k in keys(n) | n[k]] as node_values
        """
        result = tx.run(query)
        
        nodes = []
        for record in result:
            node = {
                'node_id': record['node_id'],
                'labels': record['node_labels'],
                'properties': dict(zip(record['node_keys'], record['node_values']))
            }
            nodes.append(node)
        
        return nodes

    def get_nodes_by_name(self, node_name):
        with self.begin_session() as session:
            result = session.execute_read(self._get_nodes_by_name, node_name)
            return result

    def _get_nodes_by_name(self, tx, node_name):
        query = "MATCH (n:Node {name: $node_name}) RETURN n"
        result = tx.run(query, node_name=node_name)
        return [record["n"] for record in result]

    def get_node_by_id(self, node_id):
        with self.begin_session() as session:
            result = session.execute_read(self._get_node_by_id, node_id)
            return result

    def _get_node_by_id(self, tx, node_id):
        query = """
        MATCH (n)
        WHERE id(n) = $node_id
        RETURN id(n) as node_id, labels(n) as node_labels, keys(n) as node_keys, 
               [k in keys(n) | n[k]] as node_values
        """
        params = {'node_id': node_id}
        result = tx.run(query, **params)

        # 构建结果字典，包含节点的详细信息
        node = None
        for record in result:
            node = {
                'node_id': record['node_id'],
                'labels': record['node_labels'],
                'properties': dict(zip(record['node_keys'], record['node_values'])),
            }


        return node

    def get_relationships_by_nodes_id(self, start_node_id, end_node_id):
        with self.begin_session() as session:
            result = session.read_transaction(self._get_relationships_by_nodes_id, start_node_id, end_node_id)
            return result

    def _get_relationships_by_nodes_id(self, tx, start_node_id, end_node_id):
        query = """
        MATCH (a:Node)-[r]-(b:Node)
        WHERE id(a) = $start_node_id AND id(b) = $end_node_id
        RETURN id(r) as rel_id, keys(r) as rel_keys, [k in keys(r) | r[k] ] as rel_values, 
               type(r) as rel_type, id(a) as start_node_id, id(b) as end_node_id
        """
        params = {'start_node_id': start_node_id, 'end_node_id': end_node_id}
        result = tx.run(query, **params)

        # 构建结果列表，每个结果是一个字典，包含关系的详细信息
        relationships = []
        for record in result:
            rel_details = {
                'rel_id': record['rel_id'],
                'properties': dict(zip(record['rel_keys'], record['rel_values'])),
                'type': record['rel_type'],
                'start_node_id': record['start_node_id'],
                'end_node_id': record['end_node_id']
            }
            relationships.append(rel_details)

        return relationships

    def get_relationship_by_id(self, relationship_id):
        with self.begin_session() as session:
            result = session.read_transaction(self._get_relationship_by_id, relationship_id)
            return result

    def _get_relationship_by_id(self, tx, relationship_id):
        query = """
        MATCH (a)-[r]->(b)
        WHERE id(r) = $relationship_id
        RETURN id(r) as rel_id, keys(r) as rel_keys, [k in keys(r) | r[k] ] as rel_values, 
               type(r) as rel_type, id(a) as start_node_id, id(b) as end_node_id
        """
        params = {'relationship_id': relationship_id}
        result = tx.run(query, **params)

        # 构建结果列表，每个结果是一个字典，包含关系的详细信息
        relationship = []
        for record in result:
            relationship = {
                'rel_id': record['rel_id'],
                'properties': dict(zip(record['rel_keys'], record['rel_values'])),
                'type': record['rel_type'],
                'start_node_id': record['start_node_id'],
                'end_node_id': record['end_node_id']
            }


        return relationship

    def find_nodes_by_length(self, start_node_name, length):
        with self.driver.session() as session:
            return session.execute_read(self._find_nodes_by_length, start_node_name, length)

    def _find_nodes_by_length(self, tx, start_node_name, length):
        query = f"""
        MATCH (a:Node {{name: $start_node_name}})-[*..{length}]->(b:Node)
        WHERE a.name = $start_node_name
        RETURN DISTINCT b
        """
        result = tx.run(query, start_node_name=start_node_name, length=length)
        nodes = [record["b"] for record in result]
        return nodes

    def find_nodes_by_id_and_length(self, start_node_id, length):
        with self.begin_session() as session:
            return session.execute_read(self._find_nodes_by_id_and_length, start_node_id, length)

    def _find_nodes_by_id_and_length(self, tx, start_node_id, length):
        query = """
        MATCH (a)-[*1..{}]->(b)
        WHERE id(a) = $start_node_id AND id(a) <> id(b)
        RETURN DISTINCT id(b) as node_id
        """.format(length)
        result = tx.run(query, start_node_id=start_node_id)
        return [record for record in result]

    def get_random_nodes(self, n):
        with self.driver.session() as session:
            return session.execute_read(self._get_random_nodes, n)

    def _get_random_nodes(self, tx, n):
        query = "MATCH (n:Node) RETURN id(n) AS node_id ORDER BY RAND() LIMIT $n"
        result = tx.run(query, n=n)
        node_ids = [record["node_id"] for record in result]
        return [self._get_node_by_id(tx, node_id) for node_id in node_ids]

    def add_relationship_by_nodes_id(self, start_node_id, end_node_id, relationship_type, properties):
        with self.begin_session() as session:
            result = session.write_transaction(self._add_relationship_by_nodes_id, 
                                            start_node_id, end_node_id,
                                            relationship_type, properties)
            return result

    def _add_relationship_by_nodes_id(self, tx, start_node_id, end_node_id, relationship_type, properties):
        query = f"""
        MATCH (a:Node), (b:Node)
        WHERE id(a) = $start_node_id AND id(b) = $end_node_id
        CREATE (a)-[r:{relationship_type} $properties]->(b)
        RETURN id(r) as rel_id, type(r) as rel_type, 
               id(a) as start_node_id, id(b) as end_node_id
        """
        result = tx.run(query, start_node_id=start_node_id, end_node_id=end_node_id, 
                       properties=properties)
        record = result.single()
        if record:
            return {
                'rel_id': record['rel_id'],
                'type': record['rel_type'],
                'start_node_id': record['start_node_id'],
                'end_node_id': record['end_node_id']
            }
        return None

    def get_random_nearby_nodes(self, start_node_id, count, max_depth):
        with self.begin_session() as session:
            return session.execute_read(self._get_random_nearby_nodes, 
                                     start_node_id, count, max_depth)

    def _get_random_nearby_nodes(self, tx, start_node_id, count, max_depth):
        query = """
        MATCH (a)-[*1..{}]->(b)
        WHERE id(a) = $start_node_id AND id(a) <> id(b)
        WITH DISTINCT b
        RETURN id(b) as node_id
        ORDER BY rand()
        LIMIT $count
        """.format(max_depth)
        result = tx.run(query, 
                       start_node_id=start_node_id, 
                       count=count)
        return [record for record in result]

    def search_nodes(self, name=None, limit=3):
        """根据节点名字模糊搜索节点
        Args:
            name: 要搜索的节点名字，例如 '张'
            limit: 返回结果数量限制，默认为3
        Returns:
            list: 匹配的节点列表
        """
        with self.begin_session() as session:
            return session.read_transaction(self._search_nodes, name, limit)

    def _search_nodes(self, tx, name=None, limit=3):
        # 构建查询条件
        query = ""
        params = {}

        # 处理名字条件
        if name:
            # 使用全文索引进行模糊搜索
            query = (
                f"CALL db.index.fulltext.queryNodes('{NODE_INDEX_NAME}', $name) "
                "YIELD node "
                "RETURN node "
                f"LIMIT {limit}"
            )
            params["name"] = f'"{name}"'

        result = tx.run(query, **params)
        node_list = []
       
        return [{"node_id": record["node"].id, 
                "labels": record["node"].labels,
                "properties": dict(record["node"]._properties)} for record in result]

    def search_relationships(self, rel_type=None, limit=3):
        """根据关系类型和属性模糊搜索关系
        Args:
            rel_type: 关系类型，例如 'KNOWS'
            properties: 属性字典，例如 {'since': '202'}
            limit: 返回结果数量限制，默认为3
        Returns:
            list: 匹配的关系列表
        """
        with self.begin_session() as session:
            return session.read_transaction(self._search_relationships, rel_type,  limit)

    def _search_relationships(self, tx, rel_type=None, limit=3):
        # 构建查询条件
        query = ""
        params = {}

        # 处理关系类型条件
        if rel_type:
            # 使用全文索引进行模糊搜索
            query = (
                f"CALL db.index.fulltext.queryRelationships('{RELATIONSHIP_INDEX_NAME}', $rel_type) "
                "YIELD relationship, score "
                "RETURN id(relationship) as rel_id, "
                "type(relationship) as type, "
                "properties(relationship) as properties, "
                "id(startNode(relationship)) as start_node_id, "
                "id(endNode(relationship)) as end_node_id "
                f"LIMIT {limit}"
            )
            params["rel_type"] = f'"{rel_type}"'

        result = tx.run(query, **params)
        return [{"rel_id": record["rel_id"],
                 "type": record["type"],
                 "properties": record["properties"],
                 "start_node_id": record["start_node_id"],
                 "end_node_id": record["end_node_id"]} for record in result]

    def create_indexes(self):
        """创建全文索引"""
        with self.begin_session() as session:
            try:
                # 创建节点全文索引
                session.run(f"""
                    CREATE FULLTEXT INDEX {NODE_INDEX_NAME} IF NOT EXISTS
                    FOR (n:Node)
                    ON EACH [n.name]
                """)
                
                # # 创建关系全文索引
                # session.run(f"""
                #     CREATE FULLTEXT INDEX {RELATIONSHIP_INDEX_NAME} IF NOT EXISTS
                #     FOR ()-[r:Link]-()
                #     ON EACH [type(r)]
                # """)
                
            except Exception as e:
                print(f"创建索引时出错: {str(e)}")

    def get_isolated_nodes(self):
        """查找没有任何关系连接的孤立节点
        
        Returns:
            list: 孤立节点列表，每个节点包含 node_id, labels 和 properties
        """
        with self.begin_session() as session:
            return session.execute_read(self._get_isolated_nodes)

    def _get_isolated_nodes(self, tx):
        query = """
        MATCH (n:Node)
        WHERE NOT (n)-[]-()
        RETURN id(n) as node_id, labels(n) as node_labels, 
               keys(n) as node_keys, [k in keys(n) | n[k]] as node_values
        """
        result = tx.run(query)
        
        isolated_nodes = []
        for record in result:
            node = {
                'node_id': record['node_id'],
                'labels': record['node_labels'],
                'properties': dict(zip(record['node_keys'], record['node_values']))
            }
            isolated_nodes.append(node)
        
        return isolated_nodes

    def get_all_relationships(self):
        """获取数据库中的所有关系
        
        Returns:
            list: 所有关系的列表，每个关系包含 rel_id, type, properties, start_node_id 和 end_node_id
        """
        with self.begin_session() as session:
            return session.execute_read(self._get_all_relationships)

    def _get_all_relationships(self, tx):
        query = """
        MATCH ()-[r]->()
        RETURN id(r) as rel_id, 
               type(r) as rel_type,
               keys(r) as rel_keys,
               [k in keys(r) | r[k]] as rel_values,
               id(startNode(r)) as start_node_id,
               id(endNode(r)) as end_node_id
        """
        result = tx.run(query)
        
        relationships = []
        for record in result:
            relationship = {
                'rel_id': record['rel_id'],
                'type': record['rel_type'],
                'properties': dict(zip(record['rel_keys'], record['rel_values'])),
                'start_node_id': record['start_node_id'],
                'end_node_id': record['end_node_id']
            }
            relationships.append(relationship)
        
        return relationships

def get_graph_instance():
    uri = "bolt://localhost:7687"  # 您的Neo4j数据库URI
    user = "neo4j"  # 您的Neo4j用户名
    password = "AGCF3xJumbfJD-b"  # 您的Neo4j密码
    GRAPH = Neo4jGraph(uri, user, password)
    # 创建必要的索引
    GRAPH.create_indexes()
    return GRAPH
# 使用示例


if __name__ == "__main__":
    uri = "bolt://localhost:7687"  # 您的Neo4j数据库URI
    user = "neo4j"  # 您的Neo4j用户名
    password = "12345678"  # 您的Neo4j密码

    graph = Neo4jGraph(uri, user, password)

    try:
        # 添加节点
        graph.add_node("Node1", {"id": 1})
        graph.add_node("Node2", {"id": 2})

        graph.get_relationship_by_id(1184454398579834930)

        # 添加关系
        graph.add_relationship("Node1", "Node2", "KNOWS", {"since": 2020})

        # 获取所有节点
        nodes = graph.get_all_nodes()
        print("所有节点的名称:", nodes)

        # 通过名称获取节点
        node1 = graph.get_nodes_by_name("Node1")
        print("通过名称获取的节点1:", node1)

        # 通过ID获取节点
        node_by_id = graph.get_node_by_id(1)
        print("通过ID获取的节点:", node_by_id)

        # 查找路径
        path = graph.find_path("Node1", "Node2")
        print("Node1 到 Node2 的路径:", path)

        # 获取关系
        relationships = graph.get_relationships_by_nodes_id(50, 51)
        print("Node1 和 Node2 之间的关系:", relationships)

        # 更新节点
        graph.update_node("Node1", {"updated": True})
        updated_node = graph.get_nodes_by_name("Node1")
        print("更新后的节点1:", updated_node)

        # 更新关系
        graph.update_relationship("Node1", "Node2", "KNOWS", {"since": 2019})
        updated_relationship = graph.get_relationships_byid(1, 2)
        print("更新关系后:", updated_relationship)

        # # 删除关系
        # graph.remove_relationship("Node1", "Node2", "KNOWS")
        # relationships_after_deletion = graph.get_relationships_byid(1, 2)
        # print("删除关系后:", relationships_after_deletion)
        #
        # # 删除节点
        # graph.remove_node("Node1")
        # nodes_after_deletion = graph.get_all_nodes()
        # print("删除节点后的所有节点:", nodes_after_deletion)
        graph.get_random_nodes(5)
    finally:
        # 关闭驱动
        graph.close()

