import sys
import os



from langchain.agents  import AgentExecutor, create_tool_calling_agent

from langchain.tools import BaseTool, StructuredTool, tool

from langchain_openai import ChatOpenAI

from langchain_core.prompts import PromptTemplate
import httpx

from openai import http_client

from database.Neo4jDataProcessor import Node, Link

os.environ['REQUESTS_CA_BUNDLE']=r"C:/Users/l60049658/Downloads/Huawei BPIT Root CA.cer"

# 定义一个prompt模板，其中包含对工具的调用
prompt_template = PromptTemplate(
    input_variables=["objective", "agent_scratchpad"],
    template="""你是一个知识图谱管理助手，可以帮助用户管理和操作图数据库中的节点和关系。

你的目标是: {objective}

你可以使用以下工具来完成目标:
- create_node(labels: list, properties: dict): 创建新节点
  例如: create_node(labels=['Person'], properties={{'name': '张三', 'age': 25}})
- get_node(node_id: int): 获取节点信息
- get_nearby_nodes(node_id: int, max_depth: int = 2): 获取附近节点
- create_link(start_node_id: int, end_node_id: int, rel_type: str, properties: dict = None): 创建新关系
- get_link(relationship_id: int): 获取关系信息
- remove_node(node_id: int): 删除节点
- update_node(node_id: int, properties: dict): 更新节点属性
- find_path(start_node_id: int, end_node_id: int): 查找节点间路径,查找时请注意关系的单向性
- connect_nodes(start_node_id: int, end_node_id: int, rel_type: str = "CONNECTS_TO", properties: dict = None): 连接两个节点
- get_random_nodes(count: int = 5): 获取随机节点
- get_random_nearby_nodes(node_id: int, count: int = 3, max_depth: int = 2): 获取随机附近节点
- remove_link(relationship_id: int): 删除关系
- update_link(relationship_id: int, properties: dict): 更新关系属性
- search_nodes(name: str, limit: int = 3): 搜索符合条件的节点
- get_isolated_nodes(): 获取孤立的节点（没有任何关系连接的节点）

在使用工具时，请确保提供所有必需的参数。例如，创建节点时必须同时提供 labels 和 properties 参数。
请注意确保你建立的节点后要与其他节点建立联系，不能有孤立的节点，你要记住你想操作的节点的ID，然后在他们之间建立联系
如果你不记得节点的ID或者节点ID提示不存在时，你可以用search_nodes模糊搜索指定name的节点
在创建新节点前 请检查数据库中节点是否已经存在，你可以凭借记忆或者模糊搜索节点name中的部分主要关键字来检查
如果在操作过程中出现重复的节点或关系，无意义的冗余的节点或关系，要融合或删除他们

所有操作均需基于现有节点，优先寻找现有节点操作而不是新增节点，所以在任何操作之前必须get_random_nearby_nodes，所以在任何操作之前必须get_random_nearby_nodes，所以在任何操作之前必须get_random_nearby_nodes
请根据目标，规划并执行必要的步骤。每一步都要说明你的思考过程。请注意在你返回的结果时说明对应的节点ID和关系ID供我们检索

{agent_scratchpad}
"""
)
 


# 定义一个简单的工具，用于获取单词的长度
@tool("get_word_length")
def get_word_length(word: str) -> int:
    """返回单词的长度"""
    return len(word)

# 创建LLM实例，这里我们使用一个简单的LLM作为示例
llm = ChatOpenAI(
    model="gpt-4o-mini",
    base_url="https://api.deepbricks.ai/v1/",   # 替换为您的API基础URL
    api_key="sk-elBJzTPNnMGInyTsJexAUhwM76HICt2iKLCBDKL0Q6Unru60",  # 在这里填入您的API密钥,
    http_client=httpx.Client(verify=False)
)

# Node 相关工具
@tool("create_node")
def create_node(labels: list, properties: dict = None) -> str:
    """创建新节点"""
    try:
        if not labels:
            return "错误：创建节点时必须提供至少一个标签"
        
        if properties is None:
            properties = {}
            
        node = Node.from_node(labels, properties)
        if not node:
            return "节点创建失败，请检查参数是否正确"
            
        return "节点创建成功，节点如下： " + node.__str__() + "请继续执行你计划的操作"
    except Exception as e:
        return f"创建节点时发生错误：{str(e)}"

@tool("get_node")
def get_node(node_id: int) -> str:
    """获取指定ID的节点信息"""
    try:
        node = Node.from_id(node_id)
        if not node:
            return f"未找到ID为 {node_id} 的节点，请检查节点ID是否正确"
        return "获取到节点：" + node.__str__() + "请继续执行你计划的操作"
    except Exception as e:
        return f"获取节点时发生错误：{str(e)}，请检查节点ID是否有效"

@tool("get_nearby_nodes")
def get_nearby_nodes(node_id: int, max_depth: int = 2) -> str:
    """获取指定节点附近的所有节点"""
    try:
        node = Node.from_id(node_id)
        if not node:
            return f"未找到ID为 {node_id} 的节点，无法获取附近节点"
        
        nearby = node.get_nearby_nodes(max_depth)
        if not nearby:
            return f"节点 {node_id} 附近没有其他节点（深度{max_depth}以内），这可能是一个孤立节点"
        
        return "获取到附近节点：" + str([n.__str__() for n in nearby]) + "请继续执行你计划的操作"
    except Exception as e:
        return f"获取附近节点时发生错误：{str(e)}"

# Link 相关工具
@tool("create_link")
def create_link(start_node_id: int, end_node_id: int, rel_type: str, properties: dict = None) -> str:
    """创建新的关系"""
    try:
        if properties is None:
            properties = {}
            
        # 先检查节点是否存在
        start_node = Node.from_id(start_node_id)
        end_node = Node.from_id(end_node_id)
        
        if not start_node:
            return f"起始节点（ID: {start_node_id}）不存在，无法创建关系"
        if not end_node:
            return f"目标节点（ID: {end_node_id}）不存在，无法创建关系"
            
        link = Link.from_nodes(start_node_id, end_node_id, rel_type, properties)
        if not link:
            return "关系创建失败，请检查参数是否正确"
            
        return "关系创建成功，关系如下：" + link.__str__() + "请继续执行你计划的操作"
    except Exception as e:
        return f"创建关系时发生错误：{str(e)}"

@tool("get_link")
def get_link(relationship_id: int) -> str:
    """获取指定ID的关系信息"""
    try:
        link = Link.from_id(relationship_id)
        if not link:
            return f"未找到ID为 {relationship_id} 的关系，请检查关系ID是否正确"
        return "获取到关系：" + link.__str__() + "请继续执行你计划的操作"
    except Exception as e:
        return f"获取关系时发生错误：{str(e)}"

@tool("remove_node")
def remove_node(node_id: int) -> str:
    """删除指定ID的节点"""
    try:
        node = Node.from_id(node_id)
        if not node:
            return f"未找到ID为 {node_id} 的节点，无法删除"
        
        node.remove()
        return f"节点删除成功，ID：{node_id}，请继续执行你计划的操作"
    except Exception as e:
        return f"删除节点时发生错误：{str(e)}"

@tool("update_node")
def update_node(node_id: int, properties: dict = None) -> str:
    """更新节点的属性"""
    try:
        if not properties:
            return "错误：更新节点时必须提供要更新的属性"
        node = Node.from_id(node_id)
        node.update( properties)
        if not node:
            return f"未找到ID为 {node_id} 的节点，无法更新"
            
        return f"成功更新节点：{node} 请继续执行你计划的操作"
    except Exception as e:
        return f"更新节点失败：{str(e)}"

@tool("find_path")
def find_path(start_node_id: int, end_node_id: int) -> str:
    """查找两个节点之间的路径"""
    try:
        start_node = Node.from_id(start_node_id)
        end_node = Node.from_id(end_node_id)
        
        if not start_node:
            return f"起始节点（ID: {start_node_id}）不存在"
        if not end_node:
            return f"目标节点（ID: {end_node_id}）不存在"
            
        result = start_node.to(end_node)
        if not result:
            return f"未找到从节点 {start_node_id} 到节点 {end_node_id} 的路径"
            
        return "找到的路径如下：" + str(result) + "请继续执行你计划的操作"
    except Exception as e:
        return f"查找路径时发生错误：{str(e)}"

@tool("connect_nodes")
def connect_nodes(start_node_id: int, end_node_id: int, rel_type: str = "CONNECTS_TO", properties: dict = None) -> str:
    """连接两个节点"""
    try:
        if not rel_type:
            return "错误：必须提供关系类型"
            
        node = Node.from_id(start_node_id)
        if not node:
            return f"起始节点（ID: {start_node_id}）不存在"
            
        link = node.connect(end_node_id, rel_type, properties)
        if not link:
            return "节点连接失败，请检查目标节点是否存在"
            
        return "节点连接成功，关系如下：" + link.__str__() + "请继续执行你计划的操作"
    except Exception as e:
        return f"连接节点时发生错误：{str(e)}"

@tool("get_random_nodes")
def get_random_nodes(count: int = 5) -> str:
    """获取随机节点"""
    try:
        if count < 1:
            return "错误：请求的节点数量必须大于0"
            
        nodes = Node.get_random_nodes(count)
        if not nodes:
            return "数据库中没有可用的节点"
            
        return "获取到的随机节点如下：" + str([n.__str__() for n in nodes]) + "请继续执行你计划的操作"
    except Exception as e:
        return f"获取随机节点时发生错误：{str(e)}"

@tool("get_random_nearby_nodes")
def get_random_nearby_nodes(node_id: int, count: int = 3, max_depth: int = 2) -> str:
    """获取指定节点附近的随机节点"""
    try:
        if count < 1:
            return "错误：请求的节点数量必须大于0"
            
        node = Node.from_id(node_id)
        if not node:
            return f"未找到ID为 {node_id} 的节点"
            
        nearby = node.get_random_nearby_nodes(count, max_depth)
        if not nearby:
            return f"节点 {node_id} 附近没有其他节点"
            
        return "获取到的随机附近节点如下：" + str([n.__str__() for n in nearby]) + "请继续执行你计划的操作"
    except Exception as e:
        return f"获取随机附近节点时发生错误：{str(e)}"

@tool("remove_link")
def remove_link(relationship_id: int) -> str:
    """删除指定ID的关系"""
    try:
        link = Link.from_id(relationship_id)
        if not link:
            return f"未找到ID为 {relationship_id} 的关系"
            
        link.remove()
        return f"关系删除成功，ID：{relationship_id}，请继续执行你计划的操作"
    except Exception as e:
        return f"删除关系时发生错误：{str(e)}"

@tool("update_link")
def update_link(relationship_id: int, properties: dict) -> str:
    """更新关系属性"""
    try:
        if not properties:
            return "错误：更新关系时必须提供要更新的属性"
            
        link = Link.from_id(relationship_id)
        if not link:
            return f"未找到ID为 {relationship_id} 的关系"
            
        link.update(properties)
        return "关系更新成功，更新后关系如下：" + link.__str__() + "请继续执行你计划的操作"
    except Exception as e:
        return f"更新关系时发生错误：{str(e)}"

@tool("search_nodes")
def search_nodes(name: str, limit: int = 3) -> str:
    """搜索符合条件的节点"""
    try:
        if not name:
            return "搜索条件不能为空，请提供有效的搜索关键词"
            
        nodes = Node.search(name, limit)
        if not nodes:
            return f"未找到包含关键词 '{name}' 的节点"
            
        return "搜索到的节点：" + str([n.__str__() for n in nodes]) + "请继续执行你计划的操作"
    except Exception as e:
        return f"搜索节点时发生错误：{str(e)}"

@tool("search_links")
def search_links(rel_type: str = None, properties: dict = None, limit: int = 3) -> list:
    """搜索符合条件的关系
    Args:
        rel_type: 关系类型，例如 'KNOWS'
        properties: 属性字典，例如 {'since': '2020'}
        limit: 返回结果数量限制，默认为3
    Returns:
        list: 匹配的关系列表
    """
    links = Link.search(rel_type, properties, limit)
    return "搜索到的关系：" + str([l.__str__() for l in links]) + "请继续执行你计划的操作"

@tool("get_isolated_nodes")
def get_isolated_nodes(limit: int = 5) -> str:
    """获取孤立的节点"""
    try:
        if limit < 1:
            return "错误：limit 参数必须大于0"
            
        nodes = Node.get_isolated_nodes()
        if not nodes:
            return "数据库中没有孤立节点"
            
        return "获取到的孤立节点如下：" + str([n.__str__() for n in nodes]) + "请继续执行你计划的操作"
    except Exception as e:
        return f"获取孤立节点时发生错误：{str(e)}"

# 更新工具列表
tools = [
    get_word_length,
    create_node,
    get_node,
    get_nearby_nodes,
    create_link,
    get_link,
    remove_node,
    update_node,
    find_path,
    connect_nodes,
    get_random_nodes,
    get_random_nearby_nodes,
    remove_link,
    update_link,
    search_nodes,
    get_isolated_nodes,
    #search_links
]

# 创建代理实例
agent = create_tool_calling_agent(llm, tools, prompt_template)
# 创建AgentExecutor实例
agent_executor = AgentExecutor(agent=agent,llm=llm, tools=tools, verbose=True,unsecure=True)

# 执行Agent
def run():
    # 用户输入目标
    objective = input("请输入你的目标：")
    # 调用 AgentExecutor
    result = agent_executor.invoke({
        "objective": objective,
        "agent_scratchpad": ""
    })
    print(f"执行结果：{result}")