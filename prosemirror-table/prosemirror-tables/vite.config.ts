import { defineConfig } from 'vite';

console.log("xxxxxx")

export default defineConfig({
    // 基本公共路径，适用于构建时的资源路径
    base: './',

    // 构建特定配置
    build: {
        // 指定输出路径
        outDir: 'dist',

        // 指定生成静态资源的存放路径
        assetsDir: 'assets',

        // 启用/禁用 CSS 代码拆分
        cssCodeSplit: true,

        // 配置自定义的 rollup 选项
        rollupOptions: {
            // Rollup 打包配置
        },

        // 其他构建选项...
    },

    // 开发服务器配置
    server: {
        // 指定开发服务器端口
        port: 3000,

        // 开启跨域支持
        cors: true,

        // 自动打开浏览器
        open: true,

        // 其他服务器选项...
    },

    // 插件列表
    plugins: [
        // 添加 Vite 插件
    ],

    // 配置解析别名
    resolve: {
        alias: {
            // 配置别名
        }
    },

    // 其他全局配置...
});
