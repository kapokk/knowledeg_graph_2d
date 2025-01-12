import os
import time

from langchain.agents import AgentExecutor, create_tool_calling_agent
from langchain.tools import BaseTool, tool
from langchain_openai import ChatOpenAI
from langchain_core.prompts import PromptTemplate
import httpx
from database.Neo4jDataProcessor import Node, Link

class EAgent:
    def __init__(self):
        self.llm = ChatOpenAI(
            model="gpt-4o-mini",
            base_url="https://api.deepbricks.ai/v1/",   # 替换为您的API基础URL
            api_key="sk-elBJzTPNnMGInyTsJexAUhwM76HICt2iKLCBDKL0Q6Unru60",  # 在这里填入您的API密钥,
            http_client=httpx.Client(verify=False)
        )
        
        self.prompt_template = PromptTemplate(
            input_variables=["evaluation_target", "agent_scratchpad"],
            template="""你是一个知识图谱评估助手，负责评估其他代理对图数据库的操作结果。

你需要评估的目标是: {evaluation_target}

你可以使用以下工具来进行评估:
- get_node(node_id: int): 获取节点信息
- get_nearby_nodes(node_id: int, max_depth: int = 2): 获取附近节点
- get_link(relationship_id: int): 获取关系信息
- find_path(start_node_id: int, end_node_id: int): 查找节点间路径,查找时请注意关系的单向性
- get_random_nodes(count: int = 5): 获取随机节点
- get_random_nearby_nodes(node_id: int, count: int = 3, max_depth: int = 2): 获取随机附近节点
- search_nodes(name: str, limit: int = 3): 模糊搜索指定name的节点
- get_isolated_nodes(): 获取所有孤立节点

请根据以下几个方面进行评估：
1. 数据完整性：检查节点和关系的属性是否完整
2. 关系合理性：检查节点间的关系是否合理
3. 孤立节点：检查是否存在未连接的孤立节点
4. 重复节点：检查是否存在重复节点
5. 路径可达性：检查重要节点之间是否存在有效路径

{agent_scratchpad}

请仅给出发现的问题并给出建议，不对符合评估的方面作过多言论，请注意给出的建议要结合所给的目标具体分析，请注意在你返回的结果时说明对应的节点ID和关系ID供我们检索
"""
        )

        self.tools = self._create_tools()
        self.agent = create_tool_calling_agent(self.llm, self.tools, self.prompt_template)
        self.agent_executor = AgentExecutor(
            agent=self.agent,
            llm=self.llm,
            tools=self.tools,
            verbose=True,
            unsecure=True
        )

    def _create_tools(self):
        @tool("get_node")
        def get_node(node_id: int) -> str:
            """获取指定ID的节点信息"""
            try:
                node = Node.from_id(node_id)
                if not node:
                    return f"评估发现：节点 {node_id} 不存在，这可能是一个数据完整性问题"
                return "节点信息：" + node.__str__()
            except Exception as e:
                return f"评估过程中发生错误：{str(e)}"

        @tool("get_nearby_nodes")
        def get_nearby_nodes(node_id: int, max_depth: int = 2) -> str:
            """获取指定节点附近的所有节点"""
            try:
                node = Node.from_id(node_id)
                if not node:
                    return f"评估发现：节点 {node_id} 不存在，无法评估其关联关系"
                
                nearby = node.get_nearby_nodes(max_depth)
                if not nearby:
                    return f"评估发现：节点 {node_id} 是孤立节点，没有任何关联关系"
                
                return "相关节点：" + str([n.__str__() for n in nearby])
            except Exception as e:
                return f"评估相关节点时发生错误：{str(e)}"

        @tool("get_link")
        def get_link(relationship_id: int) -> str:
            """获取指定ID的关系详细信息"""
            try:
                link = Link.from_id(relationship_id)
                if not link:
                    return f"评估发现：关系 {relationship_id} 不存在，这可能表明数据完整性问题"
                    
                return "关系信息：" + link.__str__()
            except Exception as e:
                return f"评估关系时发生错误：{str(e)}"

        @tool("find_path")
        def find_path(start_node_id: int, end_node_id: int) -> str:
            """查找两个节点之间的路径"""
            try:
                start_node = Node.from_id(start_node_id)
                end_node = Node.from_id(end_node_id)
                
                if not start_node or not end_node:
                    return f"评估发现：起始节点({start_node_id})或目标节点({end_node_id})不存在"
                    
                result = start_node.to(end_node)
                if not result:
                    return f"评估发现：节点 {start_node_id} 到节点 {end_node_id} 之间没有可达路径"
                    
                return "路径信息：" + str(result)
            except Exception as e:
                return f"评估路径时发生错误：{str(e)}"

        @tool("get_random_nodes")
        def get_random_nodes(count: int = 5) -> str:
            """获取随机节点样本"""
            try:
                if count < 1:
                    return "评估错误：请求的节点数量必须大于0"
                    
                nodes = Node.get_random_nodes(count)
                if not nodes:
                    return "评估发现：数据库中没有可用的节点，这可能是一个严重的问题"
                    
                return "随机节点样本：" + str([n.__str__() for n in nodes])
            except Exception as e:
                return f"评估过程中获取随机节点时发生错误：{str(e)}"

        @tool("get_random_nearby_nodes")
        def get_random_nearby_nodes(node_id: int, count: int = 3, max_depth: int = 2) -> str:
            """获取指定节点附近的随机节点"""
            try:
                if count < 1:
                    return "评估错误：请求的节点数量必须大于0"
                    
                node = Node.from_id(node_id)
                if not node:
                    return f"评估发现：节点 {node_id} 不存在，无法评估其邻域"
                    
                nearby = node.get_random_nearby_nodes(count, max_depth)
                if not nearby:
                    return f"评估发现：节点 {node_id} 是孤立的，在深度 {max_depth} 范围内没有相关节点"
                    
                return "随机邻域样本：" + str([n.__str__() for n in nearby])
            except Exception as e:
                return f"评估邻域时发生错误：{str(e)}"

        @tool("search_nodes")
        def search_nodes(name: str, limit: int = 3) -> str:
            """按名称搜索节点"""
            try:
                if not name:
                    return "评估错误：搜索关键词不能为空"
                    
                nodes = Node.search(name, limit)
                if not nodes:
                    return f"评估发现：没有找到包含关键词 '{name}' 的节点，这可能表明数据覆盖不足"
                    
                return "搜索结果：" + str([n.__str__() for n in nodes])
            except Exception as e:
                return f"评估搜索时发生错误：{str(e)}"

        @tool("get_isolated_nodes")
        def get_isolated_nodes() -> str:
            """获取所有孤立节点"""
            try:
                nodes = Node.get_isolated_nodes()
                if not nodes:
                    return "评估发现：数据库中没有孤立节点，这是一个好现象"
                
                return f"评估发现 {len(nodes)} 个孤立节点：" + str([n.__str__() for n in nodes])
            except Exception as e:
                return f"评估孤立节点时发生错误：{str(e)}"

        return [
            get_node,
            get_nearby_nodes,
            get_link,
            find_path,
            get_random_nodes,
            get_random_nearby_nodes,
            search_nodes,
            get_isolated_nodes
        ]

    def evaluate(self, target):
        """执行评估"""
        result = self.agent_executor.invoke({
            "evaluation_target": target,
            "agent_scratchpad": ""
        })
        return result
        
    def answer_question(self, nodes, question):
        """流式回答关于节点的问题"""


        # 使用流式调用
        response = ""


        def add_response(str):
            nonlocal response
            response += str
            print(str)





        iterations = 1
        from agent.SAgent import agent_executor as s_agent
        e_agent = EAgent()

        # 只在第一次获取用户输入
        initial_objective = str(nodes) + question
        previous_objectives = []  # 存储所有历史目标和评估
        current_objective = initial_objective

        for i in range(iterations):
            add_response(f"\n=== 第 {i + 1} 次迭代 ===")
            add_response(f"当前目标：{current_objective}")

            # 1. SAgent 执行操作，传入所有历史目标信息
            add_response("\n[SAgent 执行中...]")
            s_result = s_agent.invoke({
                "objective": current_objective,
                "previous_objectives": initial_objective,  # 传入所有历史目标
                "agent_scratchpad": ""
            })
            add_response(f"SAgent 执行结果：{s_result}")

            # 最后一轮不评估
            if i == (iterations - 1):
                break
            # 2. EAgent 评估结果
            add_response("\n[EAgent 评估中...]")
            e_result = e_agent.evaluate(f"评估 SAgent 执行的操作：{current_objective}\n执行结果：{s_result}")
            add_response(f"EAgent 评估结果：{e_result}")

            # 3. 记录当前迭代的目标和评估
            previous_objectives.append({
                "iteration": i + 1,
                "objective": current_objective,
                # "result": s_result,
                # "evaluation": e_result
            })

            # 4. 设置下一次迭代的目标为评估结果
            current_objective = f"基于评估结果进行改进：{e_result['output']}"

            yield response

        return response

def run_multi_agent_system(iterations=100):
    """运行多代理系统
    
    Args:
        iterations (int): 循环次数
    """
    from agent.SAgent import agent_executor as s_agent
    e_agent = EAgent()
    
    # 只在第一次获取用户输入
    initial_objective = input("请输入初始操作目标：")
    previous_objectives = []  # 存储所有历史目标和评估
    current_objective = initial_objective
    
    for i in range(iterations):
        print(f"\n=== 第 {i+1} 次迭代 ===")
        print(f"当前目标：{current_objective}")
        
        # 1. SAgent 执行操作，传入所有历史目标信息
        print("\n[SAgent 执行中...]")
        s_result = s_agent.invoke({
            "objective": current_objective,
            "previous_objectives": initial_objective,  # 传入所有历史目标
            "agent_scratchpad": ""
        })
        print(f"SAgent 执行结果：{s_result}")
        
        #最后一轮不评估
        if i == (iterations-1):
            break
        # 2. EAgent 评估结果
        print("\n[EAgent 评估中...]")
        e_result = e_agent.evaluate(f"评估 SAgent 执行的操作：{current_objective}\n执行结果：{s_result}")
        print(f"EAgent 评估结果：{e_result}")
        
        # 3. 记录当前迭代的目标和评估
        previous_objectives.append({
            "iteration": i + 1,
            "objective": current_objective,
            #"result": s_result,
            #"evaluation": e_result
        })
        
        # 4. 设置下一次迭代的目标为评估结果
        current_objective = f"基于评估结果进行改进：{e_result['output']}"
        
        # 5. 等待用户确认是否继续
        if i < iterations - 1:
            addition = input("\n按回车继续下一次迭代...")

        current_objective += "\n\n 另外,用户输入了追加目标,请优先实现用户追加的目标，目标:"+addition

        

if __name__ == "__main__":
    run_multi_agent_system()

    
