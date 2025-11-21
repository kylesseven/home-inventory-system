import { loadDashboardDataFromAPI } from './data.js';
import eventBus from './eventBus.js';
import UIHandlersModule from './ui-handlers.js';

export class DashboardModule {
    constructor(app, dashboardSection, breadcrumbSection, contentSection) {
        this.app = app;
        this.dashboardSection = dashboardSection;
        this.breadcrumbSection = breadcrumbSection;
        this.contentSection = contentSection;
        this.eventBus = eventBus;
        this.isVisible = false;
    }
    
    showDashboard() {
        // 使用UIHandlersModule处理UI操作
        UIHandlersModule.hideAllContentSections();
        this.isVisible = true;
        
        // 使用app实例访问DOM元素
        if (this.breadcrumbSection) {
            this.breadcrumbSection.style.display = 'none';
        }
        
        // 额外隐藏物品列表区域，确保它不显示
        const contentSection = document.querySelector('.content-section');
        if (contentSection) {
            contentSection.style.display = 'none';
        }
        
        // 显示仪表盘
        if (this.dashboardSection) {
            this.dashboardSection.style.display = 'block';
        }
        
        // 更新活动菜单项
        UIHandlersModule.updateActiveMenuItem('dashboardMenu');
        
        // 加载仪表盘数据
        this.loadDashboardDataFromServer();
        console.log('📊 显示仪表盘页面');
    }
    
    async loadDashboardDataFromServer() {
        try {
            const data = await loadDashboardDataFromAPI(this.app.API_BASE);
            
            const { categoryCount, lowInventoryCount, todayInCount, todayOutCount, totalRooms, totalContainers, totalItemsCount } = data;
            
            // 更新仪表盘显示
            const totalMaterialsElement = document.getElementById('totalMaterials');
            const lowInventoryElement = document.getElementById('lowInventory');
            const todayInElement = document.getElementById('todayIn');
            const todayOutElement = document.getElementById('todayOut');
            const totalRoomsElement = document.getElementById('totalRooms');
            const totalContainersElement = document.getElementById('totalContainers');
            const totalItemsElement = document.getElementById('totalItems');
            
            if (totalMaterialsElement) totalMaterialsElement.textContent = categoryCount;
            if (lowInventoryElement) lowInventoryElement.textContent = lowInventoryCount;
            if (todayInElement) todayInElement.textContent = todayInCount;
            if (todayOutElement) todayOutElement.textContent = todayOutCount;
            if (totalRoomsElement) totalRoomsElement.textContent = totalRooms;
            if (totalContainersElement) totalContainersElement.textContent = totalContainers;
            if (totalItemsElement) totalItemsElement.textContent = totalItemsCount;
        } catch (error) {
            console.error('Error loading dashboard data:', error);
        }
    }
}