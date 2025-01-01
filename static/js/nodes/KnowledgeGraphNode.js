class KnowledgeGraphNode extends LGraphNode {
    constructor(node) {
        super();

        let labels = node.labels
        let properties = node.properties
        this.title = "Knowledge Graph Node";
        this.size = [300, 200];

        // 初始化标签和属性
        this.labels = Array.isArray(labels) ? labels : [labels];
        this.properties = properties || {};

        // 添加输入和输出端口
        this.addInput("", "");
        this.addOutput("", "");

        // 添加 UI 控件
        this.addLabelsControl();
        this.addPropertiesControl();
    }

    addLabelsControl() {
        this.labelsWidget = this.addWidget("text", "Labels", this.labels.join(", "), (value) => {
            this.labels = value.split(",").map(label => label.trim());
        });
    }

    addPropertiesControl() {
        this.propertyWidgets = [];

        for (const key in this.properties) {
            const widget = this.addPropertyWidget(key, this.properties[key]);
            this.propertyWidgets.push(widget);
        }

        this.addPropertyButton = this.addWidget("button", "Add Property", "", () => {
            const key = prompt("Enter property key:");
            if (key) {
                const value = prompt("Enter property value:");
                this.properties[key] = value;
                this.addPropertyWidget(key, value);
                this.setSize([this.size[0], this.size[1] + 30]);
            }
        });
    }

    addPropertyWidget(key, value) {
        const widget = this.addWidget("text", key, value, (newValue) => {
            this.properties[key] = newValue;
        });
        this.propertyWidgets.push(widget);
        return widget;
    }

    onExecute() {
        const inputData = this.getInputData(0);
        this.setOutputData(0, inputData);
    }

    serialize() {
        return {
            labels: this.labels,
            properties: this.properties
        };
    }

    deserialize(data) {
        this.labels = data.labels || ["Node"];
        this.properties = data.properties || {};
        this.refreshControls();
    }

    refreshControls() {
        this.addLabelsControl();
        this.addPropertiesControl();
        this.setDirtyCanvas(true, true);
    }
}

export default KnowledgeGraphNode;
