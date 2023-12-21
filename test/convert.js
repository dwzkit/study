function parseTextToJson(text) {
    const content = [];
    let currentIndex = 0;
    let match;

    const regex = /\[(.*?)\]|\{(.*?)\}/g;

    while ((match = regex.exec(text)) !== null) {
        if (match.index > currentIndex) {
            content.push({
                type: "text",
                text: text.slice(currentIndex, match.index),
            });
        }

        if (match[1]) {
            // 处理中括号内的内容
            content.push({
                type: "input_node",
                attrs: {
                    "data-type": "input",
                    "data-placeholder": match[1],
                },
            });
        } else if (match[2]) {
            // 处理大括号内的内容
            const placeholderMatch = match[2].match(/\((.*?)\)\[(.*?)\]/);
            if (placeholderMatch) {
                const placeholder = placeholderMatch[1].trim();
                const options = placeholderMatch[2].split(", ").map((item) => `${item}`);
                const isRadio = match[2].includes("单选");
                const isCheckBox = match[2].includes("多选");

                content.push({
                    type: "input_node",
                    attrs: {
                        "data-type": isRadio ? "radio" : "checkbox",
                        "data-placeholder": placeholder,
                        "data-options": options,
                    },
                });
            }
        }

        currentIndex = regex.lastIndex;
    }

    if (currentIndex < text.length) {
        content.push({
            type: "text",
            text: text.slice(currentIndex),
        });
    }

    return [{ type: "paragraph", content }];
}

// 示例文本
const exampleText = "现在你扮演一位[高级产品经理]，帮我撰写一份周报。我希望周报的风格是{多选(请选择)[简明扼要, 专业严谨, 重点, 数据为主, 故事为主]}，本周完成的工作事项有[1.优化了APP的对话界面设计；2.上线了APP帮助中心的AB实验]。请根据以下要点生成周报：①本周工作进展，详细描述本周所做的事情及产生的结果，②下周工作安排：基于本周的结果，规划下周要推进的事项，③思考总结，如本周的收获和反思，我希望周报的风格是{单选(请选择)[简明扼要, 专业严谨, 重点, 数据为主, 故事为主]}。";

const jsonData = parseTextToJson(exampleText);
console.log(JSON.stringify(jsonData));
