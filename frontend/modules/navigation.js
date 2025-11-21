import { DashboardModule } from './dashboard.js';
import { InventoryModule } from './inventory.js';
import { MaterialsModule } from './materials.js';
import { StorageModule } from './storage.js';

export class NavigationModule {
    constructor(app) {
        this.app = app;
    }

    /**
     * 设置菜单事件监听器
     */
    setupMenuEventListeners() {
        // 仪表盘菜单
        const dashboardMenu = document.getElementById('dashboardMenu');
        if (dashboardMenu) {
            dashboardMenu.addEventListener('click', (event) => {
                event.preventDefault(); // 防止默认导航行为
                this.app.showDashboard();
            });
        }
        
        // 物料管理菜单
        const materialsMenu = document.getElementById('materialsMenu');
        if (materialsMenu) {
            materialsMenu.addEventListener('click', (event) => {
                event.preventDefault(); // 防止默认导航行为
                this.app.showMaterials();
            });
        }
        
        // 库存管理菜单
        const inventoryMenu = document.getElementById('inventoryMenu');
        if (inventoryMenu) {
            inventoryMenu.addEventListener('click', (event) => {
                event.preventDefault(); // 防止默认导航行为
                this.app.showInventory();
            });
        }
        
        // 存储空间总览菜单
        const storageOverviewMenu = document.getElementById('storageOverviewMenu');
        if (storageOverviewMenu) {
            storageOverviewMenu.addEventListener('click', (event) => {
                event.preventDefault(); // 防止默认导航行为
                this.app.showStorageOverview();
            });
        }
    }

    /**
     * 隐藏所有内容区域
     */
    hideAllContentSections() {
        // 隐藏原有内容区域
        this.app.hideContainersSection();
        if (this.app.contentSection) {
            this.app.contentSection.style.display = 'none';
        }
        this.app.hideSearchResults();
        
        // 隐藏新添加的内容区域
        const sections = [
            this.app.dashboardSection,
            this.app.materialsSection,
            this.app.inventorySection,
            this.app.storageOverviewSection
        ];
        
        sections.forEach(section => {
            if (section) {
                section.style.display = 'none';
            }
        });
    }

    /**
     * 更新活动菜单项
     */
    updateActiveMenuItem(menuItemId) {
        // 移除所有菜单项的active类
        document.querySelectorAll('.menu-item').forEach(item => {
            item.classList.remove('active');
        });
        
        // 添加当前菜单项的active类
        const activeMenuItem = document.getElementById(menuItemId);
        if (activeMenuItem) {
            activeMenuItem.classList.add('active');
        }
    }
}