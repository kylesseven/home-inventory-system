import HomeInventoryApp from './modules/app-core.js';

// 全局应用实例
let app;

// 页面加载完成后初始化应用
document.addEventListener('DOMContentLoaded', async () => {
    console.log('📄 DOM内容加载完成，准备初始化应用');
    try {
        app = new HomeInventoryApp();
        await app.init();
        // 暴露应用到全局，供HTML内联事件调用
        window.app = app;
        console.log('✅ 应用初始化完成');
    } catch (error) {
        console.error('❌ 应用初始化失败:', error);
        alert('应用初始化失败，请检查控制台日志或刷新页面重试');
    }
});