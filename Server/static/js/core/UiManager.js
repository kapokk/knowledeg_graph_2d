export class UiManager {
    constructor(canvas,apiClient) {
        this.canvas = canvas;
        this.apiClient = apiClient;
        
    }

    showAskPanel() {
        this.canvas.closePanels(); // 关闭其他面板

        const canvasWindow = this.canvas.getCanvasWindow();
        const currentObj = this.canvas;

        // 创建面板
        const panel = this.canvas.createPanel("Ask Question", {
            closable: true,
            window: canvasWindow,
            onOpen: function () {
                // 面板打开时的回调
            },
            onClose: function () {
                currentObj.ask_panel = null; // 关闭时清空引用
            }
        });

        currentObj.ask_panel = panel; // 保存面板引用
        panel.id = "ask-panel";
        panel.classList.add("settings");

        // 更新面板内容
        function updatePanelContent(uiManager) {
            panel.content.innerHTML = ""; // 清空内容

            // 添加问题输入框
            panel.addHTML("<h3>Ask a Question</h3>");
            const questionInput = document.createElement("textarea");
            questionInput.placeholder = "Enter your question here...";
            questionInput.style.marginBottom = "10px";
            panel.content.appendChild(questionInput);

            // 添加提交按钮
            const submitButton = panel.addButton("Ask",  () =>{
                const question = questionInput.value.trim();
                if (question) {
                    answerOutput.value = "Thinking...";
                    uiManager.handleAskQuestion(question, answerOutput)
                        .catch(error => {
                            answerOutput.value = `Error: ${error.message}`;
                        });
                }
            });

            // 添加答案输出框
            panel.addHTML("<h3>Answer</h3>");
            const answerOutput = document.createElement("textarea");
            answerOutput.placeholder = "Answer will appear here...";
            
            answerOutput.readOnly = true;
            panel.content.appendChild(answerOutput);

            // 添加清除按钮
            const clearButton = panel.addButton("Clear", function () {
                questionInput.value = "";
                answerOutput.value = "";
            });
            clearButton.style.marginLeft = "10px";
        }

        // 初始化面板内容
        updatePanelContent(this);

        // 将面板添加到画布容器
        this.canvas.canvas.parentNode.appendChild(panel);
    }

    async handleAskQuestion(question, answerOutput) {
        try {
            // 获取选中的节点
            const selectedNodes = this.canvas.selected_nodes || [];
            const nodeIds = Object.entries(selectedNodes).map((arr)=>{return arr[0]})

            if (nodeIds.length === 0) {
                answerOutput.value = "Please select at least one node.";
                return;
            }

            // 调用API提问
            const response = await this.apiClient.askQuestion(nodeIds, question);

            // 显示结果
            answerOutput.value = response.answer || "No answer available";
        } catch (error) {
            console.error("Error asking question:", error);
            answerOutput.value = "Error: " + error.message;
        }
    }
}
