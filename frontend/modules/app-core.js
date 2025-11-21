import { findNodeById, collectAllItems } from './utils.js';
import { NavigationModule } from './navigation.js';
import { ItemForm } from '../components/ItemForm.js';
import ContainerForm from '../components/ContainerForm.js';
import { ContainerGrid } from '../components/ContainerGrid.js';
import { ItemTable } from '../components/ItemTable.js';
import eventBus from './eventBus.js';
import StateModule from './state.js';
import UIHandlersModule from './ui-handlers.js';

// 确保ContainerGrid组件在全局可用
ContainerGrid.registerGlobal();

class HomeInventoryApp {
    constructor() {
        // 应用配置
        this.API_BASE = 'http://localhost:3000/api';
        // 使用StateModule管理状态，不再使用本地变量
        this.stateModule = StateModule;
        
        // 初始化DOM引用
        this.initializeDOMReferences();
        
        // 初始化模块
        this.initializeModules();
        
        // 初始化表单
        this.initializeForms();
        
        // 设置事件处理
        this.setupEventListeners();
    }
    
    /**
     * 初始化所有DOM元素引用
     */
    initializeDOMReferences() {
        // 主要UI元素
        this.breadcrumbSection = document.querySelector('.breadcrumb');
        this.currentPath = document.getElementById('mainCurrentPath');
        this.itemCount = document.getElementById('itemCount');
        
        // 存储概览UI元素
        this.storageCurrentPath = document.getElementById('storageCurrentPath');
        this.searchResults = document.getElementById('searchResults');
        this.searchResultsContainer = document.getElementById('searchResultsContainer');
        this.containersSection = document.getElementById('containersSection');
        this.containerCount = document.getElementById('containerCount');
        
        // 功能模块UI元素
        this.dashboardSection = document.getElementById('dashboardSection');
        this.materialsSection = document.getElementById('materialsSection');
        this.inventorySection = document.getElementById('inventorySection');
        this.contentSection = document.querySelector('.content-section');
        this.storageOverviewSection = document.getElementById('storageOverviewSection');
        this.storageContainersSection = document.getElementById('storageContainersSection');
        this.storageContainersGrid = new ContainerGrid('storageContainersGrid');
        this.storageItemsSection = document.getElementById('storageItemsSection');
        this.storageItemTable = new ItemTable('storageItemsTableContainer');
        // 为了兼容showContainerContents方法，添加itemTable引用
        this.itemTable = this.storageItemTable;
    }
    
    /**
     * 初始化所有功能模块
     */
    initializeModules() {
        // 初始化核心模块
        this.navigationModule = new NavigationModule(this);
        
        // 非核心模块将在首次使用时懒加载
        this.dashboardModule = null;
        this.inventoryModule = null;
        this.materialsModule = null;
        this.storageModule = null;
    }
    
    /**
     * 初始化表单组件
     */
    initializeForms() {
        // 初始化物品表单
        this.itemForm = new ItemForm('itemModal', this.API_BASE);
        this.itemForm.setOnSubmit(() => {
            this.refreshCurrentView();
        });
        
        // 初始化容器表单
        this.containerForm = new ContainerForm('containerModal', this.API_BASE);
        this.containerForm.setOnSubmit(() => {
            this.refreshCurrentView();
        });
    }
    
    /**
     * 设置事件监听器
     */
    setupEventListeners() {
        // 基础事件监听设置
        // 更详细的UI事件将在ui-handlers.js中实现
        this.setUpStorageOverviewEventListeners();
        
        // 调用UIHandlersModule设置所有UI事件监听器
        UIHandlersModule.setupUIEventListeners(this);
        
        // 监听状态变化
        this.setupStateChangeListeners();
    }
    
    /**
     * 设置状态变化监听器
     */
    setupStateChangeListeners() {
        eventBus.subscribe('state:selectedNodeChanged', (node) => {
            if (node) {
                this.handleNodeSelect(node);
            }
        });
        
        eventBus.subscribe('state:filterChanged', (filters) => {
            this.refreshCurrentView();
        });
        
        eventBus.subscribe('state:searchParamsChanged', (params) => {
            this.handleSearch(params.keyword);
        });
    }
    
    /**
     * 设置存储空间总览事件处理
     */
    setUpStorageOverviewEventListeners() {
        // 存储空间总览事件处理将在ui-handlers.js中实现
    }
    
    /**
     * 加载初始数据
     */
    async loadInitialData() {
        try {
            const response = await fetch(`${this.API_BASE}/areas`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const result = await response.json();
            // 处理后端返回的响应格式
            const rooms = result.data || [];
            this.stateModule.setCache('rooms', rooms);
            eventBus.publish('data-updated', { rooms: rooms });
        } catch (error) {
            console.error('Error loading initial data:', error);
            this.stateModule.setCache('rooms', []);
        }
    }
    
    /**
     * 应用初始化
     */
    async init() {
        try {
            // 等待DOM就绪
            await this.waitForDOMReady();
            
            // 设置菜单事件监听器（确保DOM已完全加载）
            if (this.navigationModule) {
                this.navigationModule.setupMenuEventListeners();
            }
            
            // 验证关键元素
            this.validateCriticalElements();
            
            // 初始加载数据
            if (!this.stateModule.getCache('rooms') || this.stateModule.getCache('rooms').length === 0) {
                await this.loadInitialData();
            } else {
                console.log('Using cached room data');
            }
            
            // 初始化完成后自动显示仪表盘
            await this.showDashboard();
            
            return true;
        } catch (error) {
            console.error('❌ 应用初始化失败:', error);
            UIHandlersModule.showError('应用初始化失败: ' + error.message);
            return false;
        }
    }
    
    /**
     * 等待DOM就绪
     */
    async waitForDOMReady() {
        if (document.readyState === 'loading') {
            await new Promise(resolve => {
                document.addEventListener('DOMContentLoaded', resolve);
            });
        }
    }
    
    /**
     * 验证关键DOM元素是否存在
     */
    validateCriticalElements() {
        const criticalElements = [
            { id: 'itemTableContainer', name: '物品表格容器' },
            { id: 'storageItemsTableContainer', name: '存储物品表格' },
            { id: 'dashboardSection', name: '仪表盘区域' },
            { id: 'inventorySection', name: '库存区域' },
            { id: 'materialsSection', name: '物料区域' },
            { id: 'storageOverviewSection', name: '存储概览区域' }
        ];
        
        criticalElements.forEach(element => {
            const el = document.getElementById(element.id) || document.querySelector(element.id);
            if (!el) {
                console.warn(`⚠️ 缺少关键DOM元素: ${element.name} (${element.id})`);
            }
        });
    }
    
    /**
     * 搜索处理
     */
    async handleSearch(searchParams) {
        // 处理搜索参数，支持字符串形式的关键词
        const searchTerm = typeof searchParams === 'string' ? searchParams : searchParams.term || '';
        const categoryFilter = typeof searchParams === 'object' ? searchParams.category || '' : '';
        
        // 从StateModule获取所有房间数据
        const rooms = this.stateModule.getCache('rooms') || [];
        
        // 搜索所有房间的物品
        const allItems = rooms.flatMap(room => collectAllItems(room));
        
        // 应用搜索条件
        let filteredItems = allItems;
        
        if (searchTerm) {
            filteredItems = filteredItems.filter(item => 
                item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                item.description.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }
        
        if (categoryFilter) {
            filteredItems = filteredItems.filter(item => 
                item.category === categoryFilter
            );
        }
        
        // 获取物品状态配置
        const itemStatusConfig = StateModule.getCache('itemStatusConfig') || [];
        // 更新搜索结果
        this.showSearchResults(filteredItems, itemStatusConfig);
        
        // 保存搜索参数
        this.stateModule.setSearchParams({ term: searchTerm, category: categoryFilter });
    }
    
    /**
     * 刷新当前视图
     */
    async refreshCurrentView() {
        await UIHandlersModule.refreshCurrentView(this);
    }
    
    /**
     * 显示添加物品表单
     */
    handleAddItemClick() {
        // 添加物品逻辑将在ui-handlers.js中实现
    }
    
    /**
     * 入库操作
     */
    async inboundItem(itemId) {
        // 懒加载库存模块
        if (!this.inventoryModule) {
            const { InventoryModule } = await import('./inventory.js');
            this.inventoryModule = new InventoryModule(this);
            // 初始化库存模块的事件和数据
            this.inventoryModule.initInventoryPage();
        }
        // 直接在当前界面打开入库表单，不跳转到库存管理界面
        this.inventoryModule.openInventoryRecordModal('in', itemId);
    }
    /**
     * 出库操作
     */
    async outboundItem(itemId) {
        // 懒加载库存模块
        if (!this.inventoryModule) {
            const { InventoryModule } = await import('./inventory.js');
            this.inventoryModule = new InventoryModule(this);
            // 初始化库存模块的事件和数据
            this.inventoryModule.initInventoryPage();
        }
        // 直接在当前界面打开出库表单，不跳转到库存管理界面
        this.inventoryModule.openInventoryRecordModal('out', itemId);
    }

    /**
     * 编辑物品
     */
    async editItem(itemId) {
        // 直接在当前界面打开编辑表单
        try {
            // 从服务器获取最新的物品数据
            const response = await fetch(`${this.API_BASE}/items/${itemId}`);
            const result = await response.json();
            if (result.success) {
                const item = result.data;
                this.itemForm.showEditForm(item);
            } else {
                alert('获取物品信息失败: ' + result.message);
            }
        } catch (error) {
            console.error('编辑物品失败:', error);
            alert('编辑物品失败，请稍后重试');
        }
    }
    
    /**
     * 删除容器
     */
    async deleteContainer(containerId, containerName, subContainerCount) {
        // 构造警告消息
        let warningMessage = `确定要删除容器 "${containerName}" 吗？`;
        if (subContainerCount > 0) {
            warningMessage += `\n此操作将同时删除该容器下的 ${subContainerCount} 个子容器。`;
        }
        warningMessage += `\n被删除容器中的物品将移动到父容器或空间。`;
        
        // 弹出确认对话框
        if (!confirm(warningMessage)) {
            return; // 用户取消操作
        }
        
        try {
            // 查找要删除的容器
            const allRooms = StateModule.getCache('rooms');
            const containerToDelete = findNodeById(allRooms, containerId, allRooms);
            
            if (!containerToDelete) {
                this.showError('找不到要删除的容器');
                return;
            }
            
            // 查找父容器
            let parentContainer = null;
            let parentNode = null;
            
            // 递归查找父容器
            const findParent = (nodes, childId) => {
                for (const node of nodes) {
                    if (node.containers) {
                        for (const container of node.containers) {
                            if (String(container.id) === String(childId) || String(container._id) === String(childId)) {
                                parentContainer = node;
                                parentNode = node;
                                return true;
                            }
                            
                            if (findParent([container], childId)) {
                                if (!parentContainer) {
                                    parentContainer = node;
                                }
                                return true;
                            }
                        }
                    }
                }
                return false;
            };
            
            findParent(allRooms, containerId);
            
            // 收集所有要删除的容器ID
            const containerIdsToDelete = [];
            const collectContainerIds = (container) => {
                containerIdsToDelete.push(container._id || container.id);
                if (container.containers) {
                    container.containers.forEach(subContainer => {
                        collectContainerIds(subContainer);
                    });
                }
            };
            collectContainerIds(containerToDelete);
            
            // 收集所有要移动的物品
            const itemsToMove = [];
            const collectItemsToMove = (container) => {
                if (container.items) {
                    itemsToMove.push(...container.items);
                }
                if (container.containers) {
                    container.containers.forEach(subContainer => {
                        collectItemsToMove(subContainer);
                    });
                }
            };
            collectItemsToMove(containerToDelete);
            
            // 发送删除请求到后端
            const response = await fetch(`${this.API_BASE}/storage_units/delete-multiple`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ storageUnitIds: containerIdsToDelete }) });
            if (!response.ok) {
                console.log('Delete request failed with status:', response.status);
                const errorData = await response.json().catch(() => {});
                console.log('Error data from server:', errorData);
                throw new Error(errorData?.message || '删除容器失败');
            }
            
            // 重新加载存储数据
            if (this.storageModule) {
                await this.storageModule.loadStorageData();
            }
            
            // 刷新当前视图
            await this.refreshCurrentView();
            
            this.showMessage('容器删除成功');
            
        } catch (error) {
            console.error('删除容器失败:', error);
            this.showError('删除容器失败: ' + error.message);
        }
    }
    
    /**
     * 统一的模块懒加载方法
     * @param {string} moduleName - 模块名称（用于属性名）
     * @param {string} modulePath - 模块文件路径
     * @param {Object} options - 配置选项
     * @returns {Promise<Object>} 加载的模块实例
     */
    async loadModule(moduleName, modulePath, options = {}) {
        // 检查模块是否已加载
        if (!this[moduleName]) {
            const module = await import(modulePath);
            
            // 获取导出名称，如果提供了exportName选项则优先使用
            const exportName = options.exportName || 
                             (moduleName.endsWith('Module') ? moduleName : moduleName.charAt(0).toUpperCase() + moduleName.slice(1));
            
            // 尝试多种导出方式：default导出、完全匹配的命名导出、首字母大写的命名导出
            const ModuleClass = module.default || 
                              module[exportName] || 
                              module[exportName.charAt(0).toUpperCase() + exportName.slice(1)] ||
                              module[moduleName.charAt(0).toUpperCase() + moduleName.slice(1)];
            
            if (typeof ModuleClass !== 'function') {
                console.error(`模块 ${moduleName} 导出检查：`, Object.keys(module));
                throw new Error(`模块 ${moduleName} 导出的不是构造函数，请检查导出方式`);
            }
            
            this[moduleName] = new ModuleClass(...(options.constructorArgs || [this]));
        }
        return this[moduleName];
    }
    
    /**
     * 显示材料 - 使用统一懒加载
     */
    async showMaterials() {
        // 明确指定exportName为'MaterialsModule'以确保正确获取命名导出的类
        const materialsModule = await this.loadModule('materialsModule', './materials.js', {
            exportName: 'MaterialsModule'
        });
        
        UIHandlersModule.hideAllContentSections();
        if (this.dashboardModule) {
            this.dashboardModule.isVisible = false;
        }
        this.materialsSection.style.display = 'block';
        this.breadcrumbSection.innerHTML = '<div id="mainCurrentPath"><li class="breadcrumb-item active">物料管理</li></div>';
        await materialsModule.loadMaterialsByCategory();
        UIHandlersModule.updateActiveMenuItem('materialsMenu');
    }
    
    /**
     * 显示库存 - 使用统一懒加载
     */
    async showInventory() {
        // 明确指定exportName为'InventoryModule'以确保正确获取命名导出的类
        const inventoryModule = await this.loadModule('inventoryModule', './inventory.js', {
            exportName: 'InventoryModule'
        });
        
        UIHandlersModule.hideAllContentSections();
        if (this.dashboardModule) {
            this.dashboardModule.isVisible = false;
        }
        this.inventorySection.style.display = 'block';
        this.breadcrumbSection.innerHTML = '<div id="mainCurrentPath"><li class="breadcrumb-item active">库存管理</li></div>';
        inventoryModule.initInventoryPage();
        UIHandlersModule.updateActiveMenuItem('inventoryMenu');
    }
    
    /**
     * 显示存储空间总览 - 使用统一懒加载
     */
    async showStorageOverview() {
        // 明确指定exportName为'StorageModule'以确保正确获取命名导出的类
        const storageModule = await this.loadModule('storageModule', './storage.js', {
            exportName: 'StorageModule'
        });
        
        // 传递app实例给storageModule的showStorageOverview方法，确保面包屑导航正常显示
        storageModule.showStorageOverview(this);
    }
    
    /**
     * 显示仪表盘 - 使用统一懒加载
     */
    async showDashboard() {
        // 首先设置当前视图为仪表盘，确保在任何事件触发前视图已正确设置
        this.currentView = 'dashboard';
        
        // 明确指定exportName为'DashboardModule'以确保正确获取命名导出的类
        const dashboardModule = await this.loadModule('dashboardModule', './dashboard.js', {
            exportName: 'DashboardModule',
            constructorArgs: [this, this.dashboardSection, this.breadcrumbSection, this.contentSection]
        });
        
        // 重置存储概览状态和选中的节点
        StateModule.setIsInStorageOverview(false);
        StateModule.setSelectedNode(null);
        StateModule.setSelectedStorageContainer(null);
        
        // 调用DashboardModule的showDashboard方法来显示仪表盘
        await dashboardModule.showDashboard();
        
        // 更新活动菜单项
        UIHandlersModule.updateActiveMenuItem('dashboardMenu');
    }

    /**
     * 更新当前路径显示
     */
    updateCurrentPath(node) {
        UIHandlersModule.updateCurrentPath(this, node);
        this.updateAddItemButton(node); // 更新添加按钮状态
    }
    
    /**
     * 显示房间容器列表
     */
    showRoomContainers(room) {
        // 使用UIHandlersModule处理房间容器显示
        UIHandlersModule.showRoomContainers(this, room);
    }
    
    /**
     * 显示容器区域
     */
    showContainersSection() {
        // 调用UIHandlersModule的showContainersSection方法来显示容器区域
        UIHandlersModule.showContainersSection(this);
    }
    
    /**
     * 隐藏搜索结果区域
     */
    hideSearchResults() {
        // 调用UIHandlersModule的hideSearchResults方法来隐藏搜索结果区域
        UIHandlersModule.hideSearchResults(this);
    }
    
    /**
     * 显示加载状态
     */
    showLoadingState() {
        // 调用UIHandlersModule的showLoadingState方法来显示加载状态
        UIHandlersModule.showLoadingState();
    }
    
    /**
     * 隐藏加载状态
     */
    hideLoadingState() {
        // 调用UIHandlersModule的hideLoadingState方法来隐藏加载状态
        UIHandlersModule.hideLoadingState();
    }
    
    /**
     * 更新添加物品按钮状态
     */
    updateAddItemButton(node) {
        // 使用UIHandlersModule处理添加按钮状态更新
        UIHandlersModule.updateAddItemButton(this, node);
        
        // 额外处理addContainerBtn和addItemBtn
        const addContainerBtn = document.getElementById('addContainerBtn');
        const addItemBtn = document.getElementById('addItemBtn');
        
        // 检查是否为房间或容器节点
        const isRoom = node && node.type === 'room';
        const isContainer = node && !isRoom && (node.id || node._id) && (node.containers || node.items || node.type || node.containerType);
        
        if (node && node.type !== 'overview' && (isRoom || isContainer)) {
            if (addContainerBtn) addContainerBtn.style.display = 'inline-block';
            if (addItemBtn) addItemBtn.style.display = 'inline-block';
        } else {
            if (addContainerBtn) addContainerBtn.style.display = 'none';
            if (addItemBtn) addItemBtn.style.display = 'none';
        }
    }
    
    /**
     * 处理节点选择事件
     * @param {Object} node - 选中的节点对象
     */
    handleNodeSelect(node) {
        // 避免循环调用：检查是否是同一个节点
        const currentNodeId = node.id || node._id;
        const existingNodeId = StateModule.getCurrentNodeId();
        
        // 如果是同一个节点，避免重复处理
        if (currentNodeId === existingNodeId) {
            return;
        }
        
        console.log('Node selected:', node);
        
        // 更新当前节点ID
        StateModule.setCurrentNodeId(currentNodeId);
        
        // 更新面包屑路径
        this.updateCurrentPath(node);
        
        // 更新添加物品按钮状态
        this.updateAddItemButton(node);
        
        // 根据节点类型执行不同的操作
        if (node.type === 'room' || node.type === 'container') {
            // 如果是房间或容器，显示其内容
            // 使用showRoomContainers但设置preventNodeSelect标志避免循环调用
            const roomWithFlag = { ...node, preventNodeSelect: true };
            this.showRoomContainers(roomWithFlag);
        } else if (node.type === 'overview') {
            // 如果是总览，刷新存储总览
            if (this.storageModule && typeof this.storageModule.showStorageOverview === 'function') {
                this.storageModule.showStorageOverview(this);
            }
        }
        
        // 触发视图刷新
        this.refreshCurrentView();
    }

    /**
     * 显示搜索结果
     */
    showSearchResults(items, itemStatusConfig = []) {
        const searchResults = document.getElementById('searchResults');
        if (searchResults) {
            searchResults.style.display = 'block';
        }
        
        const searchResultsContainer = document.getElementById('searchResultsContainer');
        if (searchResultsContainer) {
            searchResultsContainer.style.display = 'block';
        }
        
        if (this.itemTable && this.itemTable.showSearchResults) {
            this.itemTable.showSearchResults(items, itemStatusConfig);
        }
    }

}

export default HomeInventoryApp;