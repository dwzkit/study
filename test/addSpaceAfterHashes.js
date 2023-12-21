function addSpaceAfterHashes(input) {
    return input.replace(/(#+)([^#\s])/g, '$1 $2');
}

// 示例
let example = "这是一些示例文本：#内容,##内容，####内容";
let result = addSpaceAfterHashes(example);
console.log(result); // 应输出：这是一些示例文本：# 内容,## 内容，#### 内容
